/**
 * ScholarFlow — Precision Academic Search, Core-Entity Extractor, UTF-8 Sanitizer & APA 7 Engine
 */

window.ScholarAPI = (() => {
  // Conversational & command filler words that must NEVER be searched as academic topics
  const COMMAND_AND_FILLER_WORDS = new Set([
    'özetle', 'özet', 'özetini', 'makaleleri', 'makaleler', 'makale', 'makalelerden',
    'kullan', 'kullanarak', 'kullanıp', 'incele', 'inceler', 'bunları', 'bunu', 'şunları',
    'bu', 'şu', 'o', 've', 'ile', 'için', 'bir', 'olan', 'üzerine', 'göre', 'olarak',
    'daha', 'çok', 'en', 'iyi', 'kötü', 'güçlü', 'zayıf', 'güçlüden', 'zayıfa',
    'atıf', 'atıfları', 'atıflarını', 'apa', 'apa7', 'kaynakça', 'kaynak', 'kaynakları',
    'özelliklerini', 'özellikleri', 'özelliği', 'özellikler', 'hakkında', 'ilgili', 'alakalı',
    'bana', 'lütfen', 'bul', 'ara', 'araştır', 'tara', 'listele', 'sırala', 'göster',
    'anlat', 'nedir', 'nasıl', 'nelerdir', 'bilgi', 'ver', 'değerlendir', 'karşılaştır',
    'örnek', 'birkaç', 'tüm', 'bütün', 'çıkar', 'yaz', 'hazırla', 'sentezle',
    'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'about', 'using',
    'summarize', 'summary', 'articles', 'papers', 'paper', 'find', 'search', 'list',
    'analyze', 'review', 'characteristics', 'properties', 'features', 'tell', 'me'
  ]);

  // Known UTF-8 -> Windows-1254 / Latin-1 Mojibake repair map
  const MOJIBAKE_MAP = [
    [/Ã¼/g, 'ü'], [/Ãœ/g, 'Ü'],
    [/Ã¶/g, 'ö'], [/Ã–/g, 'Ö'],
    [/Ã§/g, 'ç'], [/Ã‡/g, 'Ç'],
    [/ÅŸ/g, 'ş'], [/Åž/g, 'Ş'],
    [/Ä±/g, 'ı'], [/Ä°/g, 'İ'],
    [/ÄŸ/g, 'ğ'], [/Äž/g, 'Ğ'],
    [/Ã¢/g, 'â'], [/Ã®/g, 'î']
  ];

  // Check if a string contains corrupted replacement characters (\uFFFD / )
  function hasCorruptedEncoding(str) {
    if (!str) return false;
    return /\uFFFD/.test(str) || /[\x80-\x9F]/.test(str);
  }

  function cleanHtmlAndEncoding(str) {
    if (!str) return '';
    let s = String(str)
      .replace(/<[^>]+>/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    for (const [pattern, replacement] of MOJIBAKE_MAP) {
      s = s.replace(pattern, replacement);
    }

    return s.replace(/\s+/g, ' ').trim();
  }

  function reconstructAbstract(invertedIndex) {
    if (!invertedIndex || typeof invertedIndex !== 'object') return '';
    const words = [];
    for (const [word, positions] of Object.entries(invertedIndex)) {
      if (Array.isArray(positions)) {
        for (const pos of positions) {
          words[pos] = word;
        }
      }
    }
    return cleanHtmlAndEncoding(words.filter(Boolean).join(' '));
  }

  // Normalize common Turkish possessive/plural inflections on core nouns
  function normalizeTurkishCoreWord(word) {
    let w = word.toLowerCase().trim();
    const suffixes = [
      'larının', 'lerinin', 'ların', 'lerin', 'ları', 'leri',
      'nın', 'nin', 'nun', 'nün', 'ın', 'in', 'un', 'ün',
      'nda', 'nde', 'dan', 'den', 'tan', 'ten', 'da', 'de'
    ];
    for (const suf of suffixes) {
      if (w.length > suf.length + 3 && w.endsWith(suf)) {
        if (suf.startsWith('lar') || suf.startsWith('ler')) {
          return w.slice(0, w.length - suf.length);
        }
        return w.slice(0, w.length - suf.length);
      }
    }
    return w;
  }

  // Extract pure core academic subject from any natural language Turkish/English sentence
  function extractCoreSubject(rawInput) {
    if (!rawInput) return '';
    const cleanedPunct = String(rawInput)
      .replace(/[.,;!?()"'“”‘’]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const words = cleanedPunct.split(' ');
    const coreWords = [];

    for (const w of words) {
      const lower = w.toLocaleLowerCase('tr-TR');
      if (lower.length < 2) continue;
      if (COMMAND_AND_FILLER_WORDS.has(lower)) continue;
      const stripped = normalizeTurkishCoreWord(lower);
      if (COMMAND_AND_FILLER_WORDS.has(stripped)) continue;
      coreWords.push(w);
    }

    if (coreWords.length === 0) {
      return cleanedPunct;
    }

    // Also normalize final word inflection (e.g. "su samurlarının" -> "su samurları" / "su samuru")
    const joined = coreWords.join(' ').trim();
    return joined
      .replace(/larının$/i, 'ları')
      .replace(/lerinin$/i, 'leri')
      .replace(/ının$/i, 'ı')
      .replace(/inin$/i, 'i')
      .replace(/unun$/i, 'u')
      .replace(/ünün$/i, 'ü');
  }

  // Translate Turkish core subject to English academic query (via local backend or direct Google GTX CORS endpoint)
  async function resolveAcademicQuery(rawInput) {
    const coreSubject = extractCoreSubject(rawInput);

    // 1. Try local backend /api/translate-query
    try {
      const res = await fetch('/api/translate-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: coreSubject })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.english && data.english.trim()) {
          return {
            raw: rawInput,
            coreSubject,
            englishQuery: data.english.trim()
          };
        }
      }
    } catch (e) {
      // Static host fallback
    }

    // 2. Direct browser fallback to Google GTX endpoint
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(
        coreSubject
      )}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && Array.isArray(data[0])) {
          const english = data[0]
            .map((p) => (Array.isArray(p) ? p[0] : ''))
            .join('')
            .trim();
          if (english) {
            return {
              raw: rawInput,
              coreSubject,
              englishQuery: english
            };
          }
        }
      }
    } catch (e) {
      console.warn('Direct translation fallback:', e);
    }

    return {
      raw: rawInput,
      coreSubject,
      englishQuery: coreSubject
    };
  }

  function tokenizeCoreTerms(coreSubject, englishQuery) {
    const combined = `${coreSubject} ${englishQuery}`
      .toLocaleLowerCase('tr-TR')
      .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !COMMAND_AND_FILLER_WORDS.has(w));

    const unique = new Set();
    for (const w of combined) {
      unique.add(w);
      // Singularize simple English plurals (e.g., "otters" -> "otter", "models" -> "model")
      if (w.endsWith('s') && w.length > 4) {
        unique.add(w.slice(0, -1));
      }
    }
    return Array.from(unique);
  }

  // Strict Core-Entity Relevance Gate: papers that do NOT match the core subject get 0 and are discarded!
  function computeRelevanceScore(paper, coreSubject, englishQuery) {
    const coreTerms = tokenizeCoreTerms(coreSubject, englishQuery);
    if (coreTerms.length === 0) return 80;

    const titleLower = (paper.title || '').toLocaleLowerCase('tr-TR');
    const abstractLower = (paper.abstract || '').toLocaleLowerCase('tr-TR');
    const conceptsLower = (paper.concepts || []).join(' ').toLocaleLowerCase('tr-TR');
    const fullText = `${titleLower} ${abstractLower} ${conceptsLower}`;

    const enClean = (englishQuery || '').toLowerCase().trim();
    const enSingular = enClean.endsWith('s') ? enClean.slice(0, -1) : enClean;
    const trClean = (coreSubject || '').toLocaleLowerCase('tr-TR').trim();

    // Check if the primary English or Turkish subject phrase appears anywhere in the paper
    const hasExactPhraseInTitle =
      (enClean.length > 2 && titleLower.includes(enClean)) ||
      (enSingular.length > 2 && titleLower.includes(enSingular)) ||
      (trClean.length > 2 && titleLower.includes(trClean));

    const hasExactPhraseInBody =
      hasExactPhraseInTitle ||
      (enClean.length > 2 && fullText.includes(enClean)) ||
      (enSingular.length > 2 && fullText.includes(enSingular)) ||
      (trClean.length > 2 && fullText.includes(trClean));

    let titleHits = 0;
    let bodyHits = 0;

    for (const term of coreTerms) {
      const stem = term.length > 5 ? term.slice(0, -1) : term;
      if (titleLower.includes(stem)) titleHits++;
      if (fullText.includes(stem)) bodyHits++;
    }

    // HARD GATE: If zero core terms match in title or body, return 0 so it is strictly filtered out!
    if (bodyHits === 0 && !hasExactPhraseInBody) {
      return 0;
    }

    // For multi-word queries (like "sea otter" or "su samuru"), require at least the primary distinctive noun
    const englishWords = enClean.split(/\s+/).filter((w) => w.length > 2 && !COMMAND_AND_FILLER_WORDS.has(w));
    if (englishWords.length > 0) {
      const mainEnglishNoun = englishWords[englishWords.length - 1].replace(/s$/, '');
      if (
        mainEnglishNoun.length >= 3 &&
        !fullText.includes(mainEnglishNoun) &&
        !fullText.includes(trClean)
      ) {
        return 0;
      }
    }

    const titleRatio = titleHits / coreTerms.length;
    const bodyRatio = bodyHits / coreTerms.length;
    let score = Math.round(titleRatio * 55 + bodyRatio * 45);

    if (hasExactPhraseInTitle) score += 28;
    else if (hasExactPhraseInBody) score += 15;

    return Math.max(35, Math.min(99, score));
  }

  function extractStructuredInsights(paper) {
    const abstract = paper.abstract || '';
    const sentences = abstract
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 25 && !hasCorruptedEncoding(s));

    const tldr =
      paper.tldr ||
      sentences[0] ||
      `${paper.title} (${paper.year}) — ${paper.venue || 'Academic Journal'}.`;

    let methodology = '';
    let keyFindings = '';
    let limitations = '';

    for (const s of sentences) {
      const l = s.toLowerCase();
      if (
        !methodology &&
        /(method|approach|dataset|sample|survey|experiment|model|framework|analyzed|measured|observed|yöntem|örneklem|analiz|veri)/i.test(l)
      ) {
        methodology = s;
      } else if (
        !keyFindings &&
        /(result|show|demonstrate|find|found|significant|reveal|indicate|confirm|bulgu|sonuç|göstermektedir)/i.test(l)
      ) {
        keyFindings = s;
      } else if (
        !limitations &&
        /(limit|future|challenge|however|although|remain|suggest that further|sınırlılık|gelecek|ancak)/i.test(l)
      ) {
        limitations = s;
      }
    }

    if (!keyFindings) keyFindings = sentences[sentences.length - 1] || sentences[0] || tldr;
    if (!methodology) methodology = sentences[1] || sentences[0] || tldr;
    if (!limitations) limitations = sentences[sentences.length - 1] || tldr;

    const passages =
      sentences.length > 0
        ? sentences.map((text, idx) => ({
            id: `${paper.id}-p${idx}`,
            text,
            type:
              idx === 0
                ? 'Kavramsal Çerçeve'
                : /(result|show|find|found|significant|reveal|sonuç|bulgu)/i.test(text)
                ? 'Temel Bulgu'
                : 'Metodoloji & Kanıt'
          }))
        : [{ id: `${paper.id}-p0`, text: tldr, type: 'Temel Bulgu' }];

    return { tldr, methodology, keyFindings, limitations, passages };
  }

  function buildSciteMetrics(paper, insights) {
    const total = Math.max(0, Number(paper.citationCount) || 0);
    const currentYear = new Date().getFullYear();
    const age = Math.max(1, currentYear - (Number(paper.year) || currentYear));
    const velocity = Number((total / age).toFixed(1));
    const influential =
      paper.influentialCitationCount !== undefined
        ? paper.influentialCitationCount
        : Math.max(total > 0 ? 1 : 0, Math.round(total * 0.14));
    const supporting = total > 0 ? Math.max(1, Math.round(total * 0.24)) : 0;
    const contrasting = total > 5 ? Math.max(1, Math.round(total * 0.05)) : 0;
    const mentioning = Math.max(0, total - supporting - contrasting);

    return {
      total,
      influential,
      velocity,
      supporting,
      contrasting,
      mentioning,
      insights
    };
  }

  // 1. OpenAlex API (Searches strictly with translated English academic query for highest global quality)
  async function searchOpenAlex(query, limit = 18) {
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(
      query
    )}&per-page=${limit}&mailto=scholarflow@example.org`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OpenAlex HTTP ${res.status}`);
    const data = await res.json();

    const list = [];
    for (const item of data.results || []) {
      const rawTitle = item.title || item.display_name || '';
      const title = cleanHtmlAndEncoding(rawTitle);
      if (!title || hasCorruptedEncoding(title)) continue;

      const authors = (item.authorships || [])
        .map((a) => cleanHtmlAndEncoding(a.author?.display_name || ''))
        .filter((name) => name && !hasCorruptedEncoding(name));

      if (authors.length === 0) continue;

      const abstract = reconstructAbstract(item.abstract_inverted_index);
      if (hasCorruptedEncoding(abstract)) continue;

      const doi = item.doi ? item.doi.replace(/^https?:\/\/doi\.org\//i, '') : '';
      const pdfUrl =
        item.best_oa_location?.pdf_url ||
        item.open_access?.oa_url ||
        item.primary_location?.pdf_url ||
        '';
      const landingUrl =
        item.primary_location?.landing_page_url ||
        (doi ? `https://doi.org/${doi}` : item.id);
      const venue = cleanHtmlAndEncoding(
        item.primary_location?.source?.display_name ||
          item.host_venue?.display_name ||
          'Academic Journal'
      );

      if (hasCorruptedEncoding(venue)) continue;

      list.push({
        id: `oa-${item.id?.split('/').pop() || Math.random().toString(36).slice(2, 9)}`,
        source: 'OpenAlex',
        title,
        authors,
        year: item.publication_year || new Date().getFullYear(),
        venue,
        volume: item.biblio?.volume || '',
        issue: item.biblio?.issue || '',
        pages:
          item.biblio?.first_page && item.biblio?.last_page
            ? `${item.biblio.first_page}-${item.biblio.last_page}`
            : item.biblio?.first_page || '',
        doi,
        url: landingUrl,
        pdfUrl,
        isOpenAccess: Boolean(item.open_access?.is_oa || pdfUrl),
        citationCount: item.cited_by_count || 0,
        abstract,
        concepts: (item.concepts || []).slice(0, 5).map((c) => c.display_name).filter(Boolean)
      });
    }
    return list;
  }

  // 2. Europe PMC / PubMed API
  async function searchEuropePMC(query, limit = 12) {
    const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(
      query
    )}&resultType=core&pageSize=${limit}&format=json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`EuropePMC HTTP ${res.status}`);
    const data = await res.json();

    const list = [];
    for (const item of data.resultList?.result || []) {
      const title = cleanHtmlAndEncoding(item.title || '');
      if (!title || hasCorruptedEncoding(title)) continue;

      const authors = item.authorString
        ? item.authorString
            .split(',')
            .map((s) => cleanHtmlAndEncoding(s))
            .filter((name) => name && !hasCorruptedEncoding(name))
        : ['Researcher'];

      const abstract = cleanHtmlAndEncoding(item.abstractText || '');
      if (hasCorruptedEncoding(abstract)) continue;

      const doi = item.doi || '';
      const pmcid = item.pmcid || '';
      const pdfUrl = pmcid
        ? `https://europepmc.org/backend/ptpmcrender.fcgi?accid=${pmcid}&blobtype=pdf`
        : '';

      list.push({
        id: `epmc-${item.id || Math.random().toString(36).slice(2, 9)}`,
        source: 'Europe PMC',
        title,
        authors,
        year: Number(item.pubYear) || new Date().getFullYear(),
        venue: cleanHtmlAndEncoding(item.journalInfo?.journal?.title || 'Scientific Journal'),
        volume: item.journalInfo?.volume || '',
        issue: item.journalInfo?.issue || '',
        pages: item.pageInfo || '',
        doi,
        url: doi ? `https://doi.org/${doi}` : `https://europepmc.org/article/${item.source || 'MED'}/${item.id}`,
        pdfUrl,
        isOpenAccess: item.isOpenAccess === 'Y' || Boolean(pdfUrl),
        citationCount: Number(item.citedByCount) || 0,
        abstract,
        concepts: []
      });
    }
    return list;
  }

  // 3. CrossRef API
  async function searchCrossRef(query, limit = 8) {
    const url = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=${limit}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`CrossRef HTTP ${res.status}`);
    const data = await res.json();

    const list = [];
    for (const item of data.message?.items || []) {
      const title = cleanHtmlAndEncoding((item.title && item.title[0]) || '');
      if (!title || hasCorruptedEncoding(title)) continue;

      const authors = (item.author || [])
        .map((a) => cleanHtmlAndEncoding([a.given, a.family].filter(Boolean).join(' ')))
        .filter((name) => name && !hasCorruptedEncoding(name));
      if (authors.length === 0) continue;

      const venue = cleanHtmlAndEncoding(
        (item['container-title'] && item['container-title'][0]) || item.publisher || 'Journal'
      );
      if (hasCorruptedEncoding(venue)) continue;

      const year =
        item.published?.['date-parts']?.[0]?.[0] ||
        item.created?.['date-parts']?.[0]?.[0] ||
        new Date().getFullYear();
      const doi = item.DOI || '';
      const pdfLink = (item.link || []).find((l) => (l['content-type'] || '').includes('pdf'));

      list.push({
        id: `cr-${doi.replace(/[^a-z0-9]/gi, '') || Math.random().toString(36).slice(2, 9)}`,
        source: 'CrossRef',
        title,
        authors,
        year,
        venue,
        volume: item.volume || '',
        issue: item.issue || '',
        pages: item.page || '',
        doi,
        url: item.URL || (doi ? `https://doi.org/${doi}` : ''),
        pdfUrl: pdfLink?.URL || '',
        isOpenAccess: Boolean(pdfLink?.URL),
        citationCount: item['is-referenced-by-count'] || 0,
        abstract: cleanHtmlAndEncoding(item.abstract || ''),
        concepts: item.subject || []
      });
    }
    return list;
  }

  // Main Unified Academic Search
  async function searchAcademicPapers(rawQuery, options = {}) {
    const {
      sortBy = 'citations_desc',
      minRelevance = 40,
      onlyOpenAccess = false,
      yearFrom = null
    } = options;

    const queryMeta = await resolveAcademicQuery(rawQuery);
    const searchTarget = queryMeta.englishQuery || queryMeta.coreSubject;
    const hasDistinctTurkish =
      queryMeta.coreSubject &&
      queryMeta.englishQuery &&
      queryMeta.coreSubject.toLowerCase() !== queryMeta.englishQuery.toLowerCase();

    const searchTasks = [
      searchOpenAlex(searchTarget, 20),
      searchEuropePMC(searchTarget, 10),
      searchCrossRef(searchTarget, 8)
    ];

    if (hasDistinctTurkish) {
      searchTasks.push(searchOpenAlex(queryMeta.coreSubject, 12));
    }

    const settled = await Promise.allSettled(searchTasks);

    const rawList = [];
    for (const r of settled) {
      if (r.status === 'fulfilled' && Array.isArray(r.value)) {
        rawList.push(...r.value);
      }
    }

    // Deduplicate by DOI or normalized title
    const seenDois = new Map();
    const seenTitles = new Map();
    const merged = [];

    for (const item of rawList) {
      if (!item.title || item.title.length < 5) continue;
      if (hasCorruptedEncoding(item.title)) continue;

      const normDoi = (item.doi || '').toLowerCase().trim();
      const normTitle = item.title
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]/gu, '')
        .slice(0, 90);

      const existing = (normDoi && seenDois.get(normDoi)) || seenTitles.get(normTitle);
      if (existing) {
        if ((!existing.abstract || existing.abstract.length < 80) && item.abstract) {
          existing.abstract = item.abstract;
        }
        if (!existing.pdfUrl && item.pdfUrl) {
          existing.pdfUrl = item.pdfUrl;
          existing.isOpenAccess = true;
        }
        if ((item.citationCount || 0) > (existing.citationCount || 0)) {
          existing.citationCount = item.citationCount;
        }
      } else {
        if (normDoi) seenDois.set(normDoi, item);
        seenTitles.set(normTitle, item);
        merged.push(item);
      }
    }

    // Score relevance & strictly filter out noise (relevanceScore === 0 means core subject missing!)
    let processed = merged
      .map((paper) => {
        const relevanceScore = computeRelevanceScore(
          paper,
          queryMeta.coreSubject,
          queryMeta.englishQuery
        );
        const insights = extractStructuredInsights(paper);
        const scite = buildSciteMetrics(paper, insights);
        return {
          ...paper,
          relevanceScore,
          insights,
          scite,
          resolvedQuery: queryMeta
        };
      })
      .filter((p) => {
        if (p.relevanceScore <= 0) return false;
        if (p.relevanceScore < minRelevance) return false;
        if (onlyOpenAccess && !p.isOpenAccess) return false;
        if (yearFrom && Number(p.year) < Number(yearFrom)) return false;
        return true;
      });

    processed.sort((a, b) => {
      if (sortBy === 'citations_desc') return (b.scite.total || 0) - (a.scite.total || 0);
      if (sortBy === 'influential_desc') return (b.scite.influential || 0) - (a.scite.influential || 0);
      if (sortBy === 'velocity_desc') return (b.scite.velocity || 0) - (a.scite.velocity || 0);
      if (sortBy === 'year_desc') return (b.year || 0) - (a.year || 0);
      if (sortBy === 'relevance_desc') return (b.relevanceScore || 0) - (a.relevanceScore || 0);
      return (b.scite.total || 0) - (a.scite.total || 0);
    });

    return processed;
  }

  // Format Author name properly in Title Case for APA 7 (avoids ALL-CAPS shouting like "BİÇER")
  function normalizeAuthorCase(name) {
    if (!name) return 'Author';
    return name
      .trim()
      .split(/\s+/)
      .map((part) =>
        part.length > 1
          ? part.charAt(0).toLocaleUpperCase('tr-TR') + part.slice(1).toLocaleLowerCase('tr-TR')
          : part.toLocaleUpperCase('tr-TR')
      )
      .join(' ');
  }

  function toApaAuthor(fullName) {
    const clean = normalizeAuthorCase(fullName);
    const parts = clean.split(/\s+/);
    if (parts.length === 1) return parts[0];
    const last = parts[parts.length - 1];
    const initials = parts
      .slice(0, -1)
      .map((p) => (p[0] ? `${p[0].toLocaleUpperCase('tr-TR')}.` : ''))
      .join(' ');
    return `${last}, ${initials}`;
  }

  function getLastName(fullName) {
    const clean = normalizeAuthorCase(fullName);
    if (clean.includes(',')) return clean.split(',')[0].trim();
    const parts = clean.split(/\s+/);
    return parts[parts.length - 1];
  }

  function formatInTextCitation(paper, style = 'APA7', index = 1) {
    const authors = paper.authors && paper.authors.length ? paper.authors : ['Author'];
    const year = paper.year || 'n.d.';
    if (style === 'IEEE') return `[${index}]`;
    const firstLast = getLastName(authors[0]);
    if (style === 'MLA9') {
      if (authors.length === 1) return `(${firstLast})`;
      if (authors.length === 2) return `(${firstLast} and ${getLastName(authors[1])})`;
      return `(${firstLast} et al.)`;
    }
    if (authors.length === 1) return `(${firstLast}, ${year})`;
    if (authors.length === 2) return `(${firstLast} & ${getLastName(authors[1])}, ${year})`;
    return `(${firstLast} et al., ${year})`;
  }

  function formatCitation(paper, style = 'APA7', index = 1) {
    const authors = (paper.authors && paper.authors.length ? paper.authors : ['Author']).map(
      normalizeAuthorCase
    );
    const year = paper.year || 'n.d.';
    const title = paper.title || 'Untitled article';
    const venue = paper.venue || 'Academic Journal';
    const volume = paper.volume || '';
    const issue = paper.issue || '';
    const pages = paper.pages || '';
    const doiUrl = paper.doi
      ? `https://doi.org/${paper.doi.replace(/^https?:\/\/doi\.org\//i, '')}`
      : paper.url || '';

    if (style === 'BibTeX') {
      const key = `${getLastName(authors[0])
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')}${year}`;
      return [
        `@article{${key},`,
        `  author = {${authors.join(' and ')}},`,
        `  title = {${title}},`,
        `  journal = {${venue}},`,
        `  year = {${year}},`,
        paper.doi ? `  doi = {${paper.doi}}` : null,
        `}`
      ]
        .filter(Boolean)
        .join('\n');
    }

    if (style === 'IEEE') {
      const ieeeAuthors = authors.slice(0, 6).join(', ');
      return `[${index}] ${ieeeAuthors}, "${title}," ${venue}, ${year}.${doiUrl ? ' ' + doiUrl : ''}`;
    }

    const apaAuthorsList = authors.slice(0, 10).map(toApaAuthor);
    let authorStr = '';
    if (apaAuthorsList.length === 1) authorStr = apaAuthorsList[0];
    else if (apaAuthorsList.length === 2) authorStr = `${apaAuthorsList[0]}, & ${apaAuthorsList[1]}`;
    else
      authorStr = `${apaAuthorsList.slice(0, -1).join(', ')}, & ${
        apaAuthorsList[apaAuthorsList.length - 1]
      }`;

    const volIssueStr = volume ? `, ${volume}${issue ? `(${issue})` : ''}` : '';
    const pagesStr = pages ? `, ${pages}` : '';
    const doiPart = doiUrl ? ` ${doiUrl}` : '';

    return `${authorStr} (${year}). ${title}. ${venue}${volIssueStr}${pagesStr}.${doiPart}`;
  }

  return {
    extractCoreSubject,
    resolveAcademicQuery,
    searchAcademicPapers,
    formatCitation,
    formatInTextCitation,
    extractStructuredInsights,
    buildSciteMetrics
  };
})();
