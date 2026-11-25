/**
 * ScholarFlow — Real Generative AI Academic Engine
 * Routes requests through the server-side Free LLM Proxy (/api/ai) or optional Google Gemini API key.
 * Eliminates rigid template concatenation ("...belirlenmiştir ortaya konulmuştur").
 */

window.ScholarAI = (() => {
  const STORAGE_KEY_GEMINI = 'scholarflow_gemini_config_v2';

  const HARVARD_PROFESSOR_SYSTEM_PROMPT = `Sen Harvard Üniversitesi'nde kıdemli bir akademik profesör, Q1 (Nature/Elsevier/IEEE) dergi başhakemi ve YÖK/TÜBİTAK akademik danışmanısın.
Kurallar:
1. Yanıtlarını kullanıcının dilinde ve talep ettiği dilde yaz (Türkçe istendiyse kusursuz, akıcı ve doğal Akademik Türkçe ile; İngilizce istendiyse STRICTLY Academic English ile).
2. SADECE kullanıcının sana verdiği metni veya makaleleri değerlendir/özetle. Asla konu dışı başka bir metin veya hayali makale uydurma.
3. ASLA mekanik şablon cümleler veya bozuk devrik eklemeler ("...belirlenmiştir ortaya konulmuştur" gibi) kurma. Gerçek bir bilim insanı gibi konunun özünü, mekanizmalarını ve literatürdeki bulguları sentezleyerek anlat.
4. Sana verilen akademik makaleleri kullanırken metin içinde APA 7 formatında (Yazar, Yıl) atıf ver ve yanıtın sonunda kullandığın kaynakları "APA 7 Kaynakça" başlığı altında listele.
5. Kullanıcı kendi yazdığı bir tez veya makale taslağını denetlemeni isterse:
   - Akademik Kalite Değerlendirmesi (0-100 puan)
   - Güçlü Yönler (İyi olanlar)
   - Eksik / Geliştirilmesi Gereken Yönler (Nasıl iyileştirileceği)
   - Metnin Profesör Tarafından Yeniden Yazılmış / Yükseltilmiş Akademik Versiyonu başlıklarıyla somut geri bildirim ver.`;

  const HARVARD_PROFESSOR_SYSTEM_PROMPT_EN = `You are a senior Harvard University professor, Q1 (Nature/Elsevier/IEEE) journal chief peer reviewer, and academic writing advisor.
Rules:
1. Respond STRICTLY in fluent, publication-grade Academic English. NEVER respond in Turkish.
2. Evaluate or summarize ONLY the exact user draft or academic papers provided to you. Never invent unrelated topics or fabricate papers.
3. Avoid robotic templates or filler phrases. Provide deep, substantive, constructive scholarly feedback.
4. When citing provided academic papers, use accurate APA 7 in-text citations (Author, Year) and list used sources under "APA 7 References" at the end.
5. When peer-reviewing a user's draft, structure your response clearly with:
   - Academic Score (0-100)
   - Strengths
   - Weaknesses & How to Improve
   - Professor's Elevated Academic Rewrite`;

  function getConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_GEMINI);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          mode: parsed.apiKey ? 'gemini' : 'free',
          apiKey: parsed.apiKey || '',
          model: parsed.model || 'gemini-2.5-flash'
        };
      }
    } catch (e) {
      console.warn(e);
    }
    return { mode: 'free', apiKey: '', model: 'gemini-2.5-flash' };
  }

  function saveConfig(newConfig) {
    const merged = { ...getConfig(), ...newConfig };
    merged.mode = merged.apiKey && merged.apiKey.trim().length > 10 ? 'gemini' : 'free';
    localStorage.setItem(STORAGE_KEY_GEMINI, JSON.stringify(merged));
    return merged;
  }

  function disconnectGemini() {
    const cfg = { mode: 'free', apiKey: '', model: 'gemini-2.5-flash' };
    localStorage.setItem(STORAGE_KEY_GEMINI, JSON.stringify(cfg));
    return cfg;
  }

  // Call Server-Side LLM Proxy (/api/ai) or Direct Gemini / Pollinations LLM with full multi-turn history
  async function generateAcademicResponse({
    prompt,
    history = [],
    systemInstruction = HARVARD_PROFESSOR_SYSTEM_PROMPT
  }) {
    const cfg = getConfig();
    const messages = [
      ...history.slice(-10).map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      })),
      { role: 'user', content: prompt }
    ];

    // 1. Primary: Call our server.js /api/ai endpoint (No CORS block, supports both Free LLM & Gemini)
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: systemInstruction,
          messages,
          apiKey: cfg.apiKey || '',
          model: cfg.model || 'gemini-2.5-flash'
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.text && data.text.trim().length > 10) {
          return { text: data.text.trim(), provider: data.provider || 'ScholarFlow Academic LLM' };
        }
      }
    } catch (err) {
      console.warn('Server /api/ai proxy unavailable, trying direct browser call:', err.message);
    }

    // 2. If running on static GitHub Pages without server.js AND user connected Gemini API Key
    if (cfg.apiKey && cfg.apiKey.trim().length > 10) {
      const modelName = cfg.model || 'gemini-2.5-flash';
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(
        cfg.apiKey.trim()
      )}`;
      const contents = messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemInstruction }] },
          contents,
          generationConfig: { temperature: 0.35, maxOutputTokens: 2500 }
        })
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('\n');
        if (text) return { text, provider: `Google Gemini (${modelName})` };
      }
    }

    // 3. Static browser fallback to Pollinations OpenAI endpoint
    const res = await fetch('https://text.pollinations.ai/openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai',
        messages: [{ role: 'system', content: systemInstruction }, ...messages],
        temperature: 0.35
      })
    });

    if (res.ok) {
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content;
      if (text) return { text, provider: 'ScholarFlow Free Cloud LLM' };
    }

    throw new Error('AI servisine şu an ulaşılamıyor. Lütfen tekrar deneyin.');
  }

  return {
    getConfig,
    saveConfig,
    disconnectGemini,
    generateAcademicResponse,
    HARVARD_PROFESSOR_SYSTEM_PROMPT,
    HARVARD_PROFESSOR_SYSTEM_PROMPT_EN
  };
})();
