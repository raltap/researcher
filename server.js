const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf'
};

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString('utf8');
      if (body.length > 2 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

// Helper for server-side HTTPS requests (bypasses browser CORS completely)
function fetchUrl(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const reqOptions = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'ScholarFlow-Academic-Research/2.0',
        ...(options.headers || {})
      },
      timeout: options.timeout || 22000
    };

    const req = https.request(reqOptions, (res) => {
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode, text, headers: res.headers });
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error('Request timeout'));
    });
    req.on('error', reject);

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

// Translate Turkish core subject to exact English academic terms using Google GTX free endpoint
async function translateToEnglish(text) {
  if (!text || !text.trim()) return '';
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=tr&tl=en&dt=t&q=${encodeURIComponent(
      text.trim()
    )}`;
    const res = await fetchUrl(url, { timeout: 6000 });
    if (res.status === 200) {
      const parsed = JSON.parse(res.text);
      if (Array.isArray(parsed) && Array.isArray(parsed[0])) {
        return parsed[0]
          .map((part) => (Array.isArray(part) ? part[0] : ''))
          .join('')
          .trim();
      }
    }
  } catch (e) {
    console.warn('Translation fallback:', e.message);
  }
  return text.trim();
}

// Call real LLM from backend (1. Google Gemini if key provided, 2. Pollinations OpenAI GPT-4o-mini/Mistral server-side)
async function callServerLLM({ messages, system, apiKey, model }) {
  // 1. If user provided a Google Gemini API key
  if (apiKey && apiKey.trim().length > 10) {
    const geminiModel = model || 'gemini-2.5-flash';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${encodeURIComponent(
      apiKey.trim()
    )}`;
    const contents = (messages || []).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const res = await fetchUrl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        system_instruction: system ? { parts: [{ text: system }] } : undefined,
        contents,
        generationConfig: { temperature: 0.35, maxOutputTokens: 2500 }
      }
    });

    if (res.status === 200) {
      const data = JSON.parse(res.text);
      const reply = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('\n');
      if (reply) {
        return { text: reply, provider: `Google Gemini (${geminiModel})` };
      }
    }
  }

  // 2. Free Server-Side Real LLM (Pollinations OpenAI endpoint - no CORS, real generative AI)
  const fullMessages = [];
  if (system) {
    fullMessages.push({ role: 'system', content: system });
  }
  for (const m of messages || []) {
    fullMessages.push({ role: m.role || 'user', content: m.content });
  }

  try {
    const res = await fetchUrl('https://text.pollinations.ai/openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        model: 'openai',
        messages: fullMessages,
        temperature: 0.35
      },
      timeout: 22000
    });

    if (res.status === 200) {
      const data = JSON.parse(res.text);
      const content = data.choices?.[0]?.message?.content;
      if (content && content.trim().length > 10) {
        return { text: content.trim(), provider: 'ScholarFlow Free LLM (OpenAI / Llama-3.3)' };
      }
    }
  } catch (e) {
    console.warn('Primary free LLM attempt warning:', e.message);
  }

  // 3. Secondary Free Server-Side Real LLM endpoint (Direct prompt endpoint)
  const lastUserMsg = (messages || [])[messages.length - 1]?.content || '';
  const combinedPrompt = `${system ? system + '\n\n' : ''}${lastUserMsg}`;
  const fallbackRes = await fetchUrl(
    `https://text.pollinations.ai/${encodeURIComponent(combinedPrompt.slice(0, 3500))}?model=openai`,
    { method: 'GET', timeout: 20000 }
  );
  if (fallbackRes.status === 200 && fallbackRes.text && fallbackRes.text.trim().length > 10) {
    return {
      text: fallbackRes.text.trim(),
      provider: 'ScholarFlow Free Cloud LLM'
    };
  }

  throw new Error('Free LLM service temporarily unreachable');
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // API 1: Translate & Extract Core Academic Query (TR -> EN)
  if (pathname === '/api/translate-query' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const raw = (body.query || '').trim();
      const english = await translateToEnglish(raw);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ original: raw, english }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // API 2: Server-Side Real Generative AI Proxy (Zero-Login Free LLM + Optional Gemini)
  if (pathname === '/api/ai' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const result = await callServerLLM(body);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Static files
  if (pathname === '/' || pathname === '') {
    pathname = '/index.html';
  }

  const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      const indexFallback = path.join(PUBLIC_DIR, 'index.html');
      fs.readFile(indexFallback, (indexErr, content) => {
        if (indexErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('404 Not Found');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(content);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('500 Internal Server Error');
        return;
      }
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache'
      });
      res.end(content);
    });
  });
});

server.listen(PORT, () => {
  console.log(`\n=============================================================`);
  console.log(`🎓 ScholarFlow — Awwwards Minimal Academic Research Platform`);
  console.log(`🌐 Local Server Running: http://localhost:${PORT}`);
  console.log(`=============================================================\n`);
});
