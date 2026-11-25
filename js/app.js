/**
 * ScholarFlow — Minimal Editorial Application Controller
 */

window.App = (() => {
  const THEME_KEY = 'scholarflow_theme_v2';
  const STATE_KEY = 'scholarflow_state_v2';
  const DRAFT_KEY = 'scholarflow_draft_v2';

  const TEMPLATES = {
    research_tr: {
      title: 'Eğitimde Yapay Zeka ve Akran Öğrenimi: Kuramsal Çerçeve',
      content: `1. GİRİŞ
Yükseköğretimde yapay zeka destekli sistemler ve büyük dil modelleri, öğrencilerin literatür tarama ve akademik yazım pratiklerini dönüştürmektedir. Özellikle akran eğitimi süreçlerinde anlık geri bildirim mekanizmalarının kullanımı, araştırma derinliğini artırmaktadır.

2. LİTERATÜR VE YÖNTEM
Güncel ampirik çalışmalar, birincil kaynaklara dayalı atıf doğrulamasının akademik argümantasyon kalitesini anlamlı düzeyde güçlendirdiğini göstermektedir.`
    },
    thesis_yok: {
      title: 'Yüksek Lisans Tezi — Bölüm 2: Kuramsal Çerçeve (YÖK Standartları)',
      content: `2.1. Araştırma Probleminin Kuramsal Temelleri
Bu tez çalışmasının amacı, incelenen araştırma değişkenleri arasındaki ilişkileri uluslararası ve ulusal literatür ışığında değerlendirmektir.

2.2. İlgili Araştırmalar ve Literatür Boşluğu
Literatürdeki öncü çalışmalar temel kavramları ortaya koymuş olmakla birlikte, boylamsal ve karşılaştırmalı analizlere duyulan ihtiyaç devam etmektedir.`
    },
    research_en: {
      title: 'Empirical Synthesis and Citation Context Analysis in Academic Research',
      content: `1. INTRODUCTION
Recent advancements in semantic literature discovery and automated citation verification have substantially improved scholarly writing workflows. Grounding claims in high-impact empirical evidence remains essential for peer-reviewed publications.

2. METHODOLOGY AND FINDINGS
We evaluate citation rigor, methodological transparency, and argumentative cohesion across multi-disciplinary research cohorts.`
    }
  };

  let state = {
    view: 'search',
    query: '',
    resolvedQuery: null,
    allPapers: [],
    filteredPapers: [],
    selectedPapers: [],
    citedPaperIds: [],
    chatOpen: false,
    chatHistory: [],
    lastAuditText: '',
    lastAuditRewrite: '',
    previousDraftBeforeApply: null
  };

  function saveSelectedState() {
    try {
      localStorage.setItem(
        STATE_KEY,
        JSON.stringify({
          selectedPapers: state.selectedPapers.filter((p) => p.source !== 'Yerel PDF').slice(0, 30),
          citedPaperIds: state.citedPaperIds.slice(0, 50)
        })
      );
    } catch (e) {
      // ignore storage quota errors
    }
  }

  function restoreSelectedState() {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.selectedPapers)) state.selectedPapers = parsed.selectedPapers;
      if (Array.isArray(parsed.citedPaperIds)) state.citedPaperIds = parsed.citedPaperIds;
    } catch (e) {
      // ignore
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatInlineMarkdown(escaped) {
    return escaped
      .replace(/`([^`]+)`/g, '<code class="font-mono-tabular text-[11px] px-1 py-0.5 rounded" style="background: var(--bg-surface);">$1</code>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>');
  }

  function renderMarkdown(str) {
    if (!str) return '';
    const lines = String(str).replace(/\r\n/g, '\n').split('\n');
    const out = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Markdown table detection
      if (
        line.trim().startsWith('|') &&
        i + 1 < lines.length &&
        /^\s*\|[\s:-]+\|/.test(lines[i + 1])
      ) {
        const parseRow = (r) =>
          r
            .trim()
            .replace(/^\|/, '')
            .replace(/\|$/, '')
            .split('|')
            .map((c) => formatInlineMarkdown(escapeHtml(c.trim()).replace(/&lt;br\s*\/?&gt;/gi, '<br>')));

        const headers = parseRow(line);
        i += 2; // skip header + separator
        const rows = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          rows.push(parseRow(lines[i]));
          i++;
        }

        const thead = `<thead><tr>${headers
          .map((h) => `<th class="text-left px-2.5 py-1.5 font-semibold hairline-b" style="background: var(--bg-subtle);">${h}</th>`)
          .join('')}</tr></thead>`;
        const tbody = `<tbody>${rows
          .map(
            (r) =>
              `<tr class="hairline-b">${r
                .map((c) => `<td class="px-2.5 py-1.5 align-top">${c}</td>`)
                .join('')}</tr>`
          )
          .join('')}</tbody>`;
        out.push(`<div class="overflow-x-auto my-2 rounded-lg hairline-border"><table class="w-full text-xs border-collapse">${thead}${tbody}</table></div>`);
        continue;
      }

      const trimmed = line.trim();
      if (/^---+$/.test(trimmed)) {
        out.push('<hr class="my-3 hairline-t border-0" />');
      } else if (/^####\s+/.test(trimmed)) {
        out.push(`<div class="font-semibold text-xs sm:text-sm mt-3 mb-1">${formatInlineMarkdown(escapeHtml(trimmed.replace(/^####\s+/, '')))}</div>`);
      } else if (/^###\s+/.test(trimmed)) {
        out.push(`<div class="font-semibold text-sm mt-3 mb-1">${formatInlineMarkdown(escapeHtml(trimmed.replace(/^###\s+/, '')))}</div>`);
      } else if (/^##\s+/.test(trimmed)) {
        out.push(`<div class="font-serif-editorial text-lg mt-3 mb-1">${formatInlineMarkdown(escapeHtml(trimmed.replace(/^##\s+/, '')))}</div>`);
      } else if (/^#\s+/.test(trimmed)) {
        out.push(`<div class="font-serif-editorial text-xl mt-3 mb-1">${formatInlineMarkdown(escapeHtml(trimmed.replace(/^#\s+/, '')))}</div>`);
      } else if (/^[-•]\s+/.test(trimmed)) {
        out.push(`<div class="pl-3">• ${formatInlineMarkdown(escapeHtml(trimmed.replace(/^[-•]\s+/, '')))}</div>`);
      } else if (trimmed === '') {
        out.push('<div class="h-2"></div>');
      } else {
        out.push(`<div>${formatInlineMarkdown(escapeHtml(line))}</div>`);
      }
      i++;
    }

    return out.join('');
  }

  function toast(msg) {
    const box = document.getElementById('toastBox');
    if (!box) return;
    const el = document.createElement('div');
    el.className = 'btn-ink px-4 py-2.5 rounded-xl text-xs font-medium shadow-lg transition-opacity';
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 250);
    }, 2800);
  }

  // Theme Management (Day / Night Toggle)
  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY) || 'light';
    applyTheme(saved);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    const icon = document.getElementById('themeToggleIcon');
    const text = document.getElementById('themeToggleText');
    if (theme === 'dark') {
      if (icon) icon.textContent = '☀️';
      if (text) text.textContent = 'Gündüz';
    } else {
      if (icon) icon.textContent = '🌙';
      if (text) text.textContent = 'Gece';
    }
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  }

  function updateFooterAiStatus() {
    const cfg = window.ScholarAI.getConfig();
    const footerEl = document.getElementById('footerAiStatusText');
    const assistEl = document.getElementById('assistantModeLabel');
    if (cfg.mode === 'gemini' && cfg.apiKey) {
      if (footerEl) footerEl.textContent = `AI: Google Gemini (${cfg.model}) Aktif — Ayarlar`;
      if (assistEl) assistEl.textContent = `Harvard & YÖK Akademik Danışmanı · Google Gemini (${cfg.model})`;
    } else {
      if (footerEl) footerEl.textContent = `AI: Girişsiz Ücretsiz LLM (Aktif) — Google Gemini Bağla`;
      if (assistEl) assistEl.textContent = `Harvard & YÖK Akademik Danışmanı · Ücretsiz Akademik LLM`;
    }
  }

  function openGeminiSettings() {
    const cfg = window.ScholarAI.getConfig();
    const keyInput = document.getElementById('geminiKeyInput');
    const modelInput = document.getElementById('geminiModelInput');
    if (keyInput) keyInput.value = cfg.apiKey || '';
    if (modelInput) modelInput.value = cfg.model || 'gemini-2.5-flash';
    const modal = document.getElementById('geminiModal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  }

  function closeGeminiSettings() {
    const modal = document.getElementById('geminiModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  function saveGeminiSettings() {
    const apiKey = document.getElementById('geminiKeyInput')?.value.trim() || '';
    const model = document.getElementById('geminiModelInput')?.value || 'gemini-2.5-flash';
    window.ScholarAI.saveConfig({ apiKey, model });
    updateFooterAiStatus();
    closeGeminiSettings();
    toast(apiKey ? `Google Gemini (${model}) bağlandı.` : 'Girişsiz Ücretsiz LLM modu aktif.');
  }

  function clearGeminiSettings() {
    window.ScholarAI.disconnectGemini();
    updateFooterAiStatus();
    closeGeminiSettings();
    toast('Girişsiz Ücretsiz LLM moduna geçildi.');
  }

  // View Switcher
  function switchView(viewName) {
    state.view = viewName;
    ['search', 'studio', 'about'].forEach((v) => {
      const sec = document.getElementById(`view-${v}`);
      const btn = document.getElementById(`navBtn-${v}`);
      if (sec) {
        if (v === viewName) sec.classList.remove('hidden');
        else sec.classList.add('hidden');
      }
      if (btn) {
        if (v === viewName) btn.classList.add('active');
        else btn.classList.remove('active');
      }
    });

    if (viewName === 'studio') {
      renderSelectedPapersSide();
      onEditorChange();
      updateBibliography();
    }
  }

  // Search Execution
  async function handleSearchSubmit(e) {
    if (e) e.preventDefault();
    const input = document.getElementById('searchInput');
    const q = input ? input.value.trim() : '';
    if (!q) return;
    await runSearch(q);
  }

  async function runSearch(rawQuery) {
    state.query = rawQuery;
    const listEl = document.getElementById('resultsList');
    const metaEl = document.getElementById('searchMetaLine');
    const btn = document.getElementById('searchBtn');

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Taranıyor...';
    }
    if (metaEl) metaEl.textContent = `"${rawQuery}" için akademik literatür taranıyor...`;
    if (listEl) {
      listEl.innerHTML = `<div class="py-16 text-center text-sm" style="color: var(--text-muted);">Akademik veritabanları taranıyor ve alakasız sonuçlar ayıklanıyor...</div>`;
    }

    try {
      const sortBy = document.getElementById('sortSelect')?.value || 'citations_desc';
      const papers = await window.ScholarAPI.searchAcademicPapers(rawQuery, {
        sortBy,
        minRelevance: 35
      });

      state.allPapers = papers;
      state.resolvedQuery = papers[0]?.resolvedQuery || { coreSubject: rawQuery, englishQuery: rawQuery };
      applyFilters();
      updateBadges();
    } catch (err) {
      if (listEl) {
        listEl.innerHTML = `<div class="py-12 text-sm text-rose-500">Arama hatası: ${escapeHtml(err.message)}</div>`;
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Araştır';
      }
    }
  }

  function applyFilters() {
    if (!state.query && state.allPapers.length === 0) {
      return;
    }
    const sortBy = document.getElementById('sortSelect')?.value || 'citations_desc';
    const minRel = Number(document.getElementById('relevanceSelect')?.value || 40);
    const oaOnly = Boolean(document.getElementById('oaOnlyCheck')?.checked);
    const yearWindow = Number(document.getElementById('yearFilterSelect')?.value || 0);
    const minYear = yearWindow > 0 ? new Date().getFullYear() - yearWindow : 0;

    let list = state.allPapers.filter((p) => {
      if ((p.relevanceScore || 0) < minRel) return false;
      if (oaOnly && !p.isOpenAccess) return false;
      if (minYear > 0 && (Number(p.year) || 0) < minYear) return false;
      return true;
    });

    list.sort((a, b) => {
      if (sortBy === 'citations_desc') return (b.scite?.total || 0) - (a.scite?.total || 0);
      if (sortBy === 'influential_desc') return (b.scite?.influential || 0) - (a.scite?.influential || 0);
      if (sortBy === 'velocity_desc') return (b.scite?.velocity || 0) - (a.scite?.velocity || 0);
      if (sortBy === 'year_desc') return (b.year || 0) - (a.year || 0);
      if (sortBy === 'relevance_desc') return (b.relevanceScore || 0) - (a.relevanceScore || 0);
      return (b.scite?.total || 0) - (a.scite?.total || 0);
    });

    state.filteredPapers = list;

    const metaEl = document.getElementById('searchMetaLine');
    if (metaEl) {
      const rq = state.resolvedQuery;
      const transInfo =
        rq && rq.englishQuery && rq.englishQuery.toLowerCase() !== rq.coreSubject.toLowerCase()
          ? ` (Akademik Terim: "${rq.englishQuery}")`
          : '';
      metaEl.textContent = `${list.length} MAKALE BULUNDU · KONU: "${state.query.toUpperCase()}"${transInfo}`;
    }

    renderResults();
  }

  function findPaper(id) {
    return (
      state.allPapers.find((p) => p.id === id) ||
      state.selectedPapers.find((p) => p.id === id) ||
      null
    );
  }

  function isSelected(id) {
    return state.selectedPapers.some((p) => p.id === id);
  }

  function toggleSelect(id) {
    const idx = state.selectedPapers.findIndex((p) => p.id === id);
    if (idx >= 0) {
      state.selectedPapers.splice(idx, 1);
    } else {
      const p = findPaper(id);
      if (p) {
        state.selectedPapers.push(p);
        toast(`"${p.title.slice(0, 38)}..." yazım sepetine eklendi.`);
      }
    }
    saveSelectedState();
    updateBadges();
    renderResults();
    renderSelectedPapersSide();
    onEditorChange();
  }

  function clearSelectedPapers() {
    state.selectedPapers = [];
    state.citedPaperIds = [];
    saveSelectedState();
    updateBadges();
    renderResults();
    renderSelectedPapersSide();
    onEditorChange();
    toast('Seçili makale sepeti temizlendi.');
  }

  function updateBadges() {
    const count = state.selectedPapers.length;
    const badge = document.getElementById('navSelectedBadge');
    if (badge) badge.textContent = `(${count})`;

    const clearBtn = document.getElementById('clearSelectedBtn');
    if (clearBtn) {
      if (count > 0) clearBtn.classList.remove('hidden');
      else clearBtn.classList.add('hidden');
    }

    const sumBtn = document.getElementById('summarizeResultsBtn');
    if (sumBtn) {
      sumBtn.textContent =
        count > 0 ? `Seçili (${count}) Makaleyi Asistana Özetlet →` : 'Bu Sonuçları Asistana Özetlet →';
    }

    const chatPresetBtn = document.getElementById('chatSummarizePresetBtn');
    if (chatPresetBtn) {
      chatPresetBtn.textContent =
        count > 0 ? `Seçili (${count}) Makaleyi Özetle & APA Yaz` : 'Listelenen Makaleleri Özetle & APA Yaz';
    }
  }

  // Render Minimal Swiss Editorial Paper Rows
  function renderResults() {
    const container = document.getElementById('resultsList');
    if (!container) return;

    if (state.filteredPapers.length === 0) {
      container.innerHTML = `<div class="py-14 text-center text-sm" style="color: var(--text-muted);">Bu filtreyle eşleşen makale bulunamadı.</div>`;
      return;
    }

    container.innerHTML = state.filteredPapers
      .map((paper, idx) => {
        const selected = isSelected(paper.id);
        const rankNum = String(idx + 1).padStart(2, '0');
        const apaInText = window.ScholarAPI.formatInTextCitation(paper, 'APA7', idx + 1);

        return `
        <article class="editorial-paper-row py-6 px-3 flex flex-col md:flex-row md:items-baseline justify-between gap-6 ${
          selected ? 'is-selected' : ''
        }">
          <!-- Left Rank + Content -->
          <div class="flex items-baseline gap-5 flex-1 max-w-3xl">
            <span class="font-mono-tabular text-xs opacity-45 select-none">${rankNum}</span>
            <div class="space-y-2 flex-1">
              <!-- Title -->
              <h2 onclick="window.App.openPaperDrawer('${paper.id}')" class="text-base sm:text-lg font-semibold leading-snug cursor-pointer hover:underline underline-offset-4">
                ${escapeHtml(paper.title)}
              </h2>

              <!-- Subtitle: Authors · Year · Venue · APA -->
              <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" style="color: var(--text-secondary);">
                <span>${escapeHtml((paper.authors || []).slice(0, 4).join(', '))}${
          (paper.authors || []).length > 4 ? ' et al.' : ''
        }</span>
                <span>·</span>
                <span class="font-mono-tabular font-medium" style="color: var(--text-primary);">${paper.year}</span>
                <span>·</span>
                <span class="italic truncate max-w-[260px]">${escapeHtml(paper.venue)}</span>
                <span>·</span>
                <span class="font-mono-tabular text-[11px]" style="color: var(--text-muted);">${escapeHtml(apaInText)}</span>
                ${
                  paper.isOpenAccess
                    ? `<span>·</span><a href="${escapeHtml(
                        paper.pdfUrl || paper.url
                      )}" target="_blank" rel="noopener" class="font-mono-tabular text-[11px] underline">PDF ↗</a>`
                    : ''
                }
              </div>

              <!-- Concise Finding -->
              <p class="text-xs sm:text-sm leading-relaxed line-clamp-2" style="color: var(--text-secondary);">
                ${escapeHtml(paper.insights?.keyFindings || paper.abstract || '')}
              </p>
            </div>
          </div>

          <!-- Right Metrics & Minimal Actions -->
          <div class="flex items-center justify-between md:justify-end gap-5 shrink-0 pl-9 md:pl-0">
            <!-- Citation Count + Hover Info Popover -->
            <div class="info-popover-trigger text-right">
              <div class="cursor-pointer">
                <div class="font-mono-tabular text-base sm:text-lg font-semibold">
                  ${(paper.scite?.total || 0).toLocaleString()}
                </div>
                <div class="text-[10px] font-mono-tabular uppercase tracking-wider" style="color: var(--text-muted);">
                  Atıf <span class="underline">ⓘ</span>
                </div>
              </div>
              <div class="info-popover-box">
                <div class="font-semibold mb-1.5" style="color: var(--text-primary);">Scite Atıf Dağılımı</div>
                <div class="space-y-1 font-mono-tabular text-[11px]">
                  <div class="flex justify-between"><span>Toplam Atıf:</span><strong>${paper.scite?.total || 0}</strong></div>
                  <div class="flex justify-between"><span>Etkili Atıf:</span><strong>${paper.scite?.influential || 0}</strong></div>
                  <div class="flex justify-between"><span>Destekleyen:</span><strong>${paper.scite?.supporting || 0}</strong></div>
                  <div class="flex justify-between"><span>Bahseden:</span><strong>${paper.scite?.mentioning || 0}</strong></div>
                  <div class="flex justify-between"><span>Karşıt:</span><strong>${paper.scite?.contrasting || 0}</strong></div>
                  <div class="flex justify-between"><span>Konu Alakası:</span><strong>%${paper.relevanceScore || 90}</strong></div>
                </div>
              </div>
            </div>

            <!-- Minimal 2 Action Pills -->
            <div class="flex items-center gap-2">
              <button
                onclick="window.App.toggleSelect('${paper.id}')"
                class="btn-ghost px-3 py-1.5 rounded-full text-xs font-medium ${selected ? 'active' : ''}"
              >
                ${selected ? '✓ Seçili' : '+ Seç'}
              </button>
              <button
                onclick="window.App.openPaperDrawer('${paper.id}')"
                class="btn-ghost px-3 py-1.5 rounded-full text-xs font-medium"
              >
                İncele
              </button>
            </div>
          </div>
        </article>
      `;
      })
      .join('');
  }

  // =========================================================================
  // SIDE-DRAWER 1: PAPER INSPECTOR ("KENARDA AÇ")
  // =========================================================================
  function openPaperDrawer(id) {
    const paper = findPaper(id);
    if (!paper) return;
    const drawer = document.getElementById('paperDrawer');
    const content = document.getElementById('paperDrawerContent');
    if (!drawer || !content) return;

    const selected = isSelected(paper.id);
    const apa = window.ScholarAPI.formatCitation(paper, 'APA7');
    const ieee = window.ScholarAPI.formatCitation(paper, 'IEEE', 1);
    const bibtex = window.ScholarAPI.formatCitation(paper, 'BibTeX');
    const inText = window.ScholarAPI.formatInTextCitation(paper, 'APA7');

    content.innerHTML = `
      <div class="space-y-4">
        <div class="text-xs font-mono-tabular" style="color: var(--text-muted);">
          ${paper.year} · ${escapeHtml(paper.venue)} · ${(paper.scite?.total || 0).toLocaleString()} ATIF
        </div>
        <h2 class="font-serif-editorial text-2xl sm:text-3xl leading-snug">${escapeHtml(paper.title)}</h2>
        <p class="text-xs" style="color: var(--text-secondary);">${escapeHtml((paper.authors || []).join(', '))}</p>

        <div class="flex flex-wrap items-center gap-2 pt-2">
          <button onclick="window.App.toggleSelect('${paper.id}'); window.App.openPaperDrawer('${paper.id}');" class="btn-ghost px-3.5 py-1.5 rounded-full text-xs font-medium ${
      selected ? 'active' : ''
    }">
            ${selected ? '✓ Yazım İçin Seçili' : '+ Yazım İçin Seç'}
          </button>
          <button onclick="window.App.citePaperAndGoStudio('${paper.id}')" class="btn-ghost px-3.5 py-1.5 rounded-full text-xs font-medium">
            Yazıma Atıf Ekle ${escapeHtml(inText)}
          </button>
          <button onclick="window.App.aiSummarizePaperInDrawer('${paper.id}')" class="btn-ink px-3.5 py-1.5 rounded-full text-xs font-medium">
            AI ile Özetle
          </button>
          ${
            paper.pdfUrl || paper.url
              ? `<a href="${escapeHtml(paper.pdfUrl || paper.url)}" target="_blank" rel="noopener" class="btn-ghost px-3.5 py-1.5 rounded-full text-xs font-medium">Kaynak / PDF ↗</a>`
              : ''
          }
        </div>
      </div>

      <div id="drawerAiSlot" class="hidden p-4 rounded-xl hairline-border space-y-2 text-xs sm:text-sm" style="background: var(--bg-subtle);"></div>

      <div class="space-y-3 hairline-t pt-5">
        <div class="text-xs font-mono-tabular uppercase tracking-wider" style="color: var(--text-muted);">Temel Bulgular & Metodoloji</div>
        <div class="space-y-2 text-xs sm:text-sm leading-relaxed" style="color: var(--text-secondary);">
          <p><strong style="color: var(--text-primary);">Bulgu:</strong> ${escapeHtml(paper.insights?.keyFindings || '')}</p>
          <p><strong style="color: var(--text-primary);">Yöntem:</strong> ${escapeHtml(paper.insights?.methodology || '')}</p>
        </div>
      </div>

      <div class="space-y-2 hairline-t pt-5">
        <div class="text-xs font-mono-tabular uppercase tracking-wider" style="color: var(--text-muted);">Makale Özeti (Abstract)</div>
        <p class="text-xs sm:text-sm leading-relaxed whitespace-pre-line font-academic-body" style="color: var(--text-secondary);">
          ${escapeHtml(paper.abstract || paper.insights?.tldr || '')}
        </p>
      </div>

      <div class="space-y-3 hairline-t pt-5">
        <div class="flex items-center justify-between">
          <span class="text-xs font-mono-tabular uppercase tracking-wider" style="color: var(--text-muted);">APA 7. Sürüm Kaynakça</span>
          <button onclick="window.App.copyPaperCitation('${paper.id}', 'APA7')" class="text-xs underline">Kopyala</button>
        </div>
        <p class="text-xs font-academic-body apa-hanging">${escapeHtml(apa)}</p>

        <div class="flex items-center justify-between pt-2">
          <span class="text-xs font-mono-tabular uppercase tracking-wider" style="color: var(--text-muted);">IEEE & BibTeX</span>
          <div class="flex items-center gap-3">
            <button onclick="window.App.copyPaperCitation('${paper.id}', 'IEEE')" class="text-xs underline">IEEE Kopyala</button>
            <button onclick="window.App.copyPaperCitation('${paper.id}', 'BibTeX')" class="text-xs underline">BibTeX Kopyala</button>
          </div>
        </div>
        <p class="text-xs font-mono-tabular opacity-80">${escapeHtml(ieee)}</p>
        <pre class="text-[11px] font-mono-tabular p-3 rounded-lg overflow-x-auto" style="background: var(--bg-subtle);">${escapeHtml(bibtex)}</pre>
      </div>
    `;

    drawer.classList.remove('closed');
    drawer.classList.add('open');
  }

  function copyPaperCitation(id, style) {
    const paper = findPaper(id);
    if (!paper) return;
    const formatted = window.ScholarAPI.formatCitation(paper, style, 1);
    navigator.clipboard?.writeText(formatted);
    toast(`${style} kaynakça kopyalandı.`);
  }

  function closePaperDrawer() {
    const drawer = document.getElementById('paperDrawer');
    if (drawer) {
      drawer.classList.add('closed');
      drawer.classList.remove('open');
    }
  }

  async function aiSummarizePaperInDrawer(id) {
    const paper = findPaper(id);
    const slot = document.getElementById('drawerAiSlot');
    if (!paper || !slot) return;

    slot.classList.remove('hidden');
    slot.innerHTML = `<div class="text-xs opacity-70">Makale analiz ediliyor...</div>`;

    try {
      const apaInText = window.ScholarAPI.formatInTextCitation(paper, 'APA7');
      const res = await window.ScholarAI.generateAcademicResponse({
        prompt: `Aşağıdaki bilimsel makaleyi Türkçe olarak 3 kısa maddede (1. Araştırmanın Amacı, 2. Temel Bulgusu, 3. Tez veya makalede ${apaInText} atıfıyla nasıl kullanılabileceğine dair örnek cümle) özetle:\nBaşlık: ${paper.title}\nYazarlar (${paper.year}): ${(paper.authors || []).join(', ')}\nÖzet: ${paper.abstract || paper.insights?.tldr}`
      });
      slot.innerHTML = `<div class="font-semibold text-xs mb-1">Akademik AI Özeti</div><div class="whitespace-pre-line leading-relaxed">${renderMarkdown(res.text)}</div>`;
    } catch (e) {
      slot.innerHTML = `<div class="text-xs text-rose-500">${escapeHtml(e.message)}</div>`;
    }
  }

  function citePaperAndGoStudio(id) {
    const p = findPaper(id);
    if (!p) return;
    if (!isSelected(p.id)) state.selectedPapers.push(p);
    updateBadges();
    closePaperDrawer();
    switchView('studio');
    insertCitationToEditor(p.id);
  }

  // =========================================================================
  // VIEW 2: ACADEMIC WRITING STUDIO & LIVE EVIDENCE MATCHER
  // =========================================================================
  function isBuiltInTemplateContent(text) {
    const t = (text || '').trim();
    if (!t) return true;
    return Object.values(TEMPLATES).some((tpl) => tpl.content.trim() === t);
  }

  function saveDraftToStorage() {
    try {
      const title = document.getElementById('docTitleInput')?.value || '';
      const content = document.getElementById('editorTextarea')?.value || '';
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, content }));
    } catch (e) {
      // ignore storage errors
    }
  }

  function restoreDraftFromStorage() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      const titleEl = document.getElementById('docTitleInput');
      const editorEl = document.getElementById('editorTextarea');
      if (titleEl && typeof saved.title === 'string' && saved.title.trim()) {
        titleEl.value = saved.title;
      }
      if (editorEl && typeof saved.content === 'string') {
        editorEl.value = saved.content;
      }
    } catch (e) {
      // ignore
    }
  }

  function loadTemplate(key) {
    const selectEl = document.getElementById('templateSelect');
    if (!key) return;
    const tpl = TEMPLATES[key];
    if (!tpl) return;
    const titleEl = document.getElementById('docTitleInput');
    const editorEl = document.getElementById('editorTextarea');
    const currentText = (editorEl?.value || '').trim();

    if (currentText && !isBuiltInTemplateContent(currentText)) {
      const ok = window.confirm('Editörde yazdığınız mevcut metin seçilen şablonla değiştirilsin mi?');
      if (!ok) {
        if (selectEl) selectEl.value = '';
        return;
      }
    }

    if (titleEl) titleEl.value = tpl.title;
    if (editorEl) editorEl.value = tpl.content;

    const stdEl = document.getElementById('reviewStandardSelect');
    if (stdEl) {
      stdEl.value = key === 'research_en' ? 'EN_Q1' : 'TR_YOK';
    }
    if (selectEl) selectEl.value = '';
    onEditorChange();
  }

  function clearEditor() {
    const titleEl = document.getElementById('docTitleInput');
    const editorEl = document.getElementById('editorTextarea');
    const card = document.getElementById('editorAuditCard');
    if (editorEl) editorEl.value = '';
    if (titleEl) titleEl.value = '';
    if (card) card.classList.add('hidden');
    saveDraftToStorage();
    onEditorChange();
    toast('Editör temizlendi.');
  }

  function renderSelectedPapersSide() {
    const el = document.getElementById('selectedPapersSideList');
    if (!el) return;
    if (state.selectedPapers.length === 0) {
      el.innerHTML = `<div class="text-xs opacity-60">Henüz makale seçilmedi. Araştırma sekmesinden "+ Seç" ile ekleyin.</div>`;
      return;
    }

    const style = document.getElementById('styleSelect')?.value || 'APA7';
    el.innerHTML = state.selectedPapers
      .map((p, idx) => {
        const inText = window.ScholarAPI.formatInTextCitation(p, style, idx + 1);
        return `
        <div class="p-3 rounded-xl hairline-border space-y-1 text-xs">
          <div class="flex items-center justify-between">
            <span class="font-mono-tabular font-medium">${escapeHtml(inText)}</span>
            <div class="flex items-center gap-2">
              <button onclick="window.App.insertCitationToEditor('${p.id}')" class="underline font-medium">+ Atıf Ekle</button>
              <button onclick="window.App.toggleSelect('${p.id}')" class="opacity-50 hover:opacity-100">✕</button>
            </div>
          </div>
          <div onclick="window.App.openPaperDrawer('${p.id}')" class="font-medium cursor-pointer hover:underline line-clamp-2">
            ${escapeHtml(p.title)}
          </div>
        </div>
      `;
      })
      .join('');
  }

  function onEditorChange() {
    const editorEl = document.getElementById('editorTextarea');
    const wordEl = document.getElementById('wordCountBadge');
    const passagesEl = document.getElementById('livePassagesList');
    if (!editorEl) return;

    const text = editorEl.value || '';
    const words = text.trim().split(/\s+/).filter(Boolean);
    if (wordEl) wordEl.textContent = `${words.length} kelime`;
    saveDraftToStorage();

    if (!passagesEl) return;
    if (state.selectedPapers.length === 0) {
      passagesEl.innerHTML = `<div class="text-xs opacity-60">Seçili makaleleriniz olduğunda yazdığınız cümleyle alakalı kısımlar burada belirir.</div>`;
      return;
    }

    const cursor = editorEl.selectionStart || text.length;
    const activePara = text.slice(0, cursor).split(/\n+/).pop() || text;
    const tokens = new Set(
      activePara
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 3)
    );

    const style = document.getElementById('styleSelect')?.value || 'APA7';
    const matches = [];

    state.selectedPapers.forEach((p, idx) => {
      const inText = window.ScholarAPI.formatInTextCitation(p, style, idx + 1);
      (p.insights?.passages || []).forEach((pas) => {
        let hits = 0;
        const pWords = pas.text.toLowerCase().split(/\s+/);
        for (const pw of pWords) {
          if (pw.length > 3 && tokens.has(pw)) hits++;
        }
        matches.push({
          paper: p,
          inText,
          text: pas.text,
          score: hits
        });
      });
    });

    matches.sort((a, b) => b.score - a.score);
    const top = matches.slice(0, 4);

    passagesEl.innerHTML = top
      .map(
        (m) => `
      <div class="p-3 rounded-xl hairline-border space-y-2 text-xs" style="background: var(--bg-subtle);">
        <div class="flex items-center justify-between font-mono-tabular text-[11px]">
          <span class="font-semibold">${escapeHtml(m.inText)}</span>
          <button onclick="window.App.insertCitationToEditor('${m.paper.id}')" class="underline font-medium">+ Metne Atıf Ekle</button>
        </div>
        <p class="leading-relaxed italic" style="color: var(--text-secondary);">"${escapeHtml(m.text)}"</p>
      </div>
    `
      )
      .join('');

    updateBibliography();
  }

  function insertCitationToEditor(paperId) {
    const paper = findPaper(paperId);
    const editorEl = document.getElementById('editorTextarea');
    if (!paper || !editorEl) return;

    if (!state.citedPaperIds.includes(paper.id)) {
      state.citedPaperIds.push(paper.id);
    }

    const style = document.getElementById('styleSelect')?.value || 'APA7';
    const idx = state.citedPaperIds.indexOf(paper.id) + 1;
    const inText = window.ScholarAPI.formatInTextCitation(paper, style, idx);

    const pos = editorEl.selectionStart ?? editorEl.value.length;
    const before = editorEl.value.slice(0, pos);
    const after = editorEl.value.slice(pos);
    const pad = before.endsWith(' ') || before.length === 0 ? '' : ' ';

    editorEl.value = `${before}${pad}${inText}${after}`;
    editorEl.focus();
    saveSelectedState();
    saveDraftToStorage();
    updateBibliography();
    toast(`${inText} eklendi.`);
  }

  function onStyleChange() {
    renderSelectedPapersSide();
    onEditorChange();
    updateBibliography();
  }

  function getBibliographyPapers() {
    const map = new Map();
    for (const id of state.citedPaperIds) {
      const p = findPaper(id);
      if (p) map.set(p.id, p);
    }
    for (const p of state.selectedPapers) {
      if (!map.has(p.id)) map.set(p.id, p);
    }
    return Array.from(map.values());
  }

  function updateBibliography() {
    const el = document.getElementById('bibliographyList');
    const headingEl = document.getElementById('bibliographyHeading');
    if (!el) return;
    const style = document.getElementById('styleSelect')?.value || 'APA7';
    if (headingEl) {
      const labels = { APA7: 'APA 7', IEEE: 'IEEE', MLA9: 'MLA 9', Chicago: 'Chicago' };
      headingEl.textContent = `Otomatik Kaynakça (${labels[style] || style})`;
    }
    const papers = getBibliographyPapers();
    if (papers.length === 0) {
      el.innerHTML = `<div class="text-xs opacity-60">Seçili veya atıf yapılmış makale bulunmuyor.</div>`;
      return;
    }
    el.innerHTML = papers
      .map((p, i) => `<div class="apa-hanging">${escapeHtml(window.ScholarAPI.formatCitation(p, style, i + 1))}</div>`)
      .join('');
  }

  function appendBibliographyToText() {
    const editorEl = document.getElementById('editorTextarea');
    if (!editorEl) return;
    const style = document.getElementById('styleSelect')?.value || 'APA7';
    const std = document.getElementById('reviewStandardSelect')?.value || 'TR_YOK';
    const papers = getBibliographyPapers();
    if (papers.length === 0) {
      toast('Önce makale seçin.');
      return;
    }
    const refs = papers.map((p, i) => window.ScholarAPI.formatCitation(p, style, i + 1)).join('\n\n');
    const heading = std === 'EN_Q1' ? `REFERENCES (${style})` : `KAYNAKÇA (${style})`;
    const clean = editorEl.value.replace(/\n\n(KAYNAKÇA|REFERENCES)[\s\S]*$/i, '');
    editorEl.value = `${clean.trim()}\n\n${heading}\n${refs}\n`;
    onEditorChange();
    toast('Kaynakça metnin sonuna eklendi.');
  }

  function copyBibliography() {
    const style = document.getElementById('styleSelect')?.value || 'APA7';
    const papers = getBibliographyPapers();
    const refs = papers.map((p, i) => window.ScholarAPI.formatCitation(p, style, i + 1)).join('\n\n');
    navigator.clipboard?.writeText(refs);
    toast('Kaynakça panoya kopyalandı.');
  }

  function extractRewriteSection(auditText) {
    if (!auditText) return '';
    const match = auditText.match(
      /(?:^|\n)(?:#+\s*)?4\.\s*(?:Professor['’]s Elevated Academic Rewrite|Metnin Profesör Tarafından Geliştirilmiş Akademik Yeniden Yazımı)[^\n]*\n([\s\S]+)$/i
    );
    if (!match || !match[1]) return '';
    return match[1].replace(/^\s*---+\s*\n?/, '').replace(/\n?\s*---+\s*$/, '').trim();
  }

  function copyAuditReport() {
    if (!state.lastAuditText) return;
    navigator.clipboard?.writeText(state.lastAuditText);
    toast('Denetim raporu kopyalandı.');
  }

  function applyAuditRewrite() {
    const editorEl = document.getElementById('editorTextarea');
    if (!editorEl || !state.lastAuditRewrite) return;
    state.previousDraftBeforeApply = editorEl.value;
    editorEl.value = state.lastAuditRewrite;
    onEditorChange();
    const undoBtn = document.getElementById('undoAuditRewriteBtn');
    if (undoBtn) undoBtn.classList.remove('hidden');
    toast('Geliştirilmiş metin editöre aktarıldı.');
  }

  function undoAuditRewrite() {
    const editorEl = document.getElementById('editorTextarea');
    if (!editorEl || state.previousDraftBeforeApply === null) return;
    editorEl.value = state.previousDraftBeforeApply;
    state.previousDraftBeforeApply = null;
    onEditorChange();
    const undoBtn = document.getElementById('undoAuditRewriteBtn');
    if (undoBtn) undoBtn.classList.add('hidden');
    toast('Önceki taslak geri yüklendi.');
  }

  async function auditEditorWithAI() {
    const editorEl = document.getElementById('editorTextarea');
    const titleEl = document.getElementById('docTitleInput');
    const card = document.getElementById('editorAuditCard');
    const std = document.getElementById('reviewStandardSelect')?.value || 'TR_YOK';
    if (!editorEl || !card) return;

    const draft = editorEl.value.trim();
    if (!draft) {
      toast('Denetlemek için önce metninizi editöre yazın veya yapıştırın.');
      editorEl.focus();
      return;
    }

    const docTitle = (titleEl?.value || '').trim();
    const isEnglish = std === 'EN_Q1';

    card.classList.remove('hidden');
    card.innerHTML = `<div class="text-xs opacity-70">${
      isEnglish
        ? 'Harvard Professor is peer-reviewing your draft in Academic English...'
        : 'Harvard Profesörü metninizi denetliyor...'
    }</div>`;

    const prompt = isEnglish
      ? `Evaluate ONLY the exact academic draft provided below as a senior peer reviewer for an International Q1 SCI/SSCI Journal (Academic English & APA 7).
IMPORTANT: Respond STRICTLY in Academic English. Do NOT write in Turkish. Do NOT invent unrelated topics — base every single point strictly on the draft below.

Structure your review with these exact 4 sections:
1. Academic Score (0-100)
2. Strengths
3. Weaknesses & How to Improve
4. Professor's Elevated Academic Rewrite (in Academic English)

${docTitle ? `Title: ${docTitle}\n` : ''}Draft:
"""
${draft}
"""`
      : `SADECE aşağıda verilen akademik taslağı "Türkiye Akademik Standartları (YÖK Tez Yazım Kılavuzu / TÜBİTAK / TR Dizin)" kriterlerine göre bir başhakem olarak değerlendir.
ÖNEMLİ: Başka bir konu veya metin uydurma; tüm değerlendirmeni birebir aşağıdaki metne göre yap ve Akademik Türkçe ile yanıtla.

Yanıtını şu 4 başlıkla yapılandır:
1. Akademik Puan (0-100)
2. Güçlü Yönler
3. Eksik / Zayıf Yönler ve Nasıl Geliştirileceği
4. Metnin Profesör Tarafından Geliştirilmiş Akademik Yeniden Yazımı

${docTitle ? `Başlık: ${docTitle}\n` : ''}Metin:
"""
${draft}
"""`;

    try {
      const res = await window.ScholarAI.generateAcademicResponse({
        prompt,
        history: [],
        systemInstruction: isEnglish
          ? window.ScholarAI.HARVARD_PROFESSOR_SYSTEM_PROMPT_EN
          : window.ScholarAI.HARVARD_PROFESSOR_SYSTEM_PROMPT
      });

      state.lastAuditText = res.text;
      state.lastAuditRewrite = extractRewriteSection(res.text);

      card.innerHTML = `
        <div class="flex flex-wrap items-center justify-between gap-2 hairline-b pb-2.5">
          <span class="text-xs font-mono-tabular uppercase tracking-wider">${
            isEnglish ? 'Academic Peer-Review Report' : 'Akademik Hakem Denetim Raporu'
          } (${escapeHtml(res.provider)})</span>
          <div class="flex items-center gap-2">
            <button onclick="window.App.copyAuditReport()" class="btn-ghost px-2.5 py-1 rounded-full text-[11px]">Raporu Kopyala</button>
            ${
              state.lastAuditRewrite
                ? `<button onclick="window.App.applyAuditRewrite()" class="btn-ink px-2.5 py-1 rounded-full text-[11px]">Yeniden Yazımı Editöre Aktar</button>
                   <button id="undoAuditRewriteBtn" onclick="window.App.undoAuditRewrite()" class="hidden btn-ghost px-2.5 py-1 rounded-full text-[11px]">Geri Al</button>`
                : ''
            }
            <button onclick="document.getElementById('editorAuditCard').classList.add('hidden')" class="text-xs opacity-60 hover:opacity-100 px-1">✕</button>
          </div>
        </div>
        <div class="text-xs sm:text-sm leading-relaxed space-y-1">${renderMarkdown(res.text)}</div>
      `;
    } catch (e) {
      card.innerHTML = `<div class="text-xs text-rose-500">Denetim sırasında hata: ${escapeHtml(e.message)}</div>`;
    }
  }

  function exportDoc() {
    const title = (document.getElementById('docTitleInput')?.value || 'Akademik_Taslak').trim();
    const content = document.getElementById('editorTextarea')?.value || '';
    const paragraphs = content
      .split(/\n{2,}/)
      .map((p) => `<p style="margin:0 0 12pt 0; line-height:1.5;">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
      .join('');

    const wordHtml = `\uFEFF<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: 'Times New Roman', Georgia, serif; font-size: 12pt; color: #111; line-height: 1.5; margin: 2.5cm; }
  h1 { font-size: 16pt; margin-bottom: 14pt; }
</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  ${paragraphs}
</body>
</html>`;

    const blob = new Blob([wordHtml], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.slice(0, 40).replace(/[^\p{L}\p{N}_-]+/gu, '_') || 'Makale'}.doc`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Word belgesi (.doc) indirildi.');
  }

  // =========================================================================
  // SLIDE-OVER DRAWER 2: HARVARD PROFESSOR AI CHAT (SMART INTENT + REAL LLM)
  // =========================================================================
  function clearChat() {
    state.chatHistory = [];
    const box = document.getElementById('chatMessages');
    if (box) box.innerHTML = '';
    appendChatBubble(
      'assistant',
      'Sohbet temizlendi. Seçtiğiniz makaleleri özetletebilir, yeni literatür tarayabilir veya taslağınızı denetletebilirsiniz.'
    );
  }

  function toggleChatDrawer(forceOpen) {
    const drawer = document.getElementById('chatDrawer');
    if (!drawer) return;
    state.chatOpen = typeof forceOpen === 'boolean' ? forceOpen : !state.chatOpen;
    if (state.chatOpen) {
      drawer.classList.remove('closed');
      drawer.classList.add('open');
    } else {
      drawer.classList.add('closed');
      drawer.classList.remove('open');
    }
  }

  function appendChatBubble(role, text, papers = []) {
    const box = document.getElementById('chatMessages');
    if (!box) return;
    const div = document.createElement('div');
    const isUser = role === 'user';

    const papersHtml =
      papers.length > 0
        ? `<div class="mt-3 pt-3 hairline-t space-y-2">
            <div class="text-[11px] font-mono-tabular uppercase tracking-wider opacity-70">Kullanılan Akademik Makaleler (Atıf Sıralı):</div>
            ${papers
              .slice(0, 5)
              .map((p, idx) => {
                const inText = window.ScholarAPI.formatInTextCitation(p, 'APA7', idx + 1);
                return `
                <div class="p-2.5 rounded-lg hairline-border text-xs space-y-1" style="background: var(--bg-surface);">
                  <div class="flex justify-between font-mono-tabular text-[11px]">
                    <span>#${idx + 1} · ${(p.scite?.total || 0).toLocaleString()} Atıf</span>
                    <span>${escapeHtml(inText)}</span>
                  </div>
                  <div onclick="window.App.openPaperDrawer('${p.id}')" class="font-medium cursor-pointer hover:underline">
                    ${escapeHtml(p.title)}
                  </div>
                </div>
              `;
              })
              .join('')}
          </div>`
        : '';

    div.className = `flex flex-col ${isUser ? 'items-end' : 'items-start'}`;
    div.innerHTML = `
      <div class="max-w-[92%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed ${
        isUser ? 'btn-ink' : 'hairline-border'
      }" style="${!isUser ? 'background: var(--bg-subtle); color: var(--text-primary);' : ''}">
        <div class="${isUser ? 'whitespace-pre-line' : 'space-y-1'}">${isUser ? escapeHtml(text) : renderMarkdown(text)}</div>
        ${papersHtml}
      </div>
    `;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
  }

  async function quickAskAssistantOnResults() {
    toggleChatDrawer(true);
    await askAssistantPreset('summarize_current');
  }

  async function askAssistantPreset(type) {
    if (type === 'summarize_current') {
      const hasSelected = state.selectedPapers.length > 0;
      const msg = hasSelected
        ? `Seçtiğim ${state.selectedPapers.length} makaleyi incele, temel bulgularını sentezleyerek özetle ve APA 7 atıflarını yaz.`
        : `Şu an listelenen "${state.query}" makalelerini incele, temel bulgularını sentezleyerek özetle ve APA 7 atıflarını yaz.`;
      await processChatMessage(msg, { isPreset: true, noSearch: true, showUsedPapers: true });
    } else if (type === 'audit_tr') {
      const draft = (document.getElementById('editorTextarea')?.value || '').trim();
      if (!draft) {
        toast('Denetlemek için önce Yazım Stüdyosu editörüne metninizi yazın.');
        return;
      }
      await processChatMessage(
        `Yazım stüdyosundaki şu taslağımı Türkiye Akademik Standartlarında (YÖK Tez / TR Dizin) denetle, iyi ve eksik yönlerini söyle ve geliştirilmiş halini yaz:\n\n"""\n${draft}\n"""`,
        { isPreset: true, noSearch: true, forceLanguage: 'tr', isAudit: true }
      );
    } else if (type === 'audit_en') {
      const draft = (document.getElementById('editorTextarea')?.value || '').trim();
      if (!draft) {
        toast('Please write or paste your draft in the Writing Studio editor first.');
        return;
      }
      await processChatMessage(
        `Please peer-review ONLY the following draft according to Q1 International Journal (Academic English & APA 7) standards. Respond STRICTLY in Academic English. Provide Academic Score (0-100), Strengths, Weaknesses & How to Improve, and an Elevated Academic Rewrite:\n\n"""\n${draft}\n"""`,
        { isPreset: true, noSearch: true, forceLanguage: 'en', isAudit: true }
      );
    }
  }

  async function handleChatSubmit(e) {
    if (e) e.preventDefault();
    const input = document.getElementById('chatInput');
    const text = input ? input.value.trim() : '';
    if (!text) return;
    input.value = '';
    await processChatMessage(text, { isPreset: false });
  }

  async function processChatMessage(userText, opts = {}) {
    const isPreset = typeof opts === 'boolean' ? opts : Boolean(opts.isPreset);
    const noSearch = typeof opts === 'object' ? Boolean(opts.noSearch) : false;
    const forceLanguage = typeof opts === 'object' ? opts.forceLanguage || null : null;
    const isAudit = typeof opts === 'object' ? Boolean(opts.isAudit) : false;
    const showUsedPapers = typeof opts === 'object' ? Boolean(opts.showUsedPapers) : false;

    const btn = document.getElementById('chatSubmitBtn');
    const displayUserText = isPreset ? userText.split('\n')[0] : userText;
    appendChatBubble('user', displayUserText);

    if (btn) {
      btn.disabled = true;
      btn.textContent = '...';
    }

    try {
      const lower = userText.toLocaleLowerCase('tr-TR');

      // Turkish-safe substring check (JS \b fails on Turkish characters like ı, ö, ü, ş, ç, ğ)
      const refersToExistingOrAction =
        /(seçili|seçtiğim|seçtiklerim|seçilen|onları|onlardan|bunları|bunlardan|bunu|bu makale|şunları|listelenen|yukarıdaki|mevcut|özetle|özet çıkar|özetini|sentezle|karşılaştır|denetle|hakem|peer-review|taslağım|yazımı|iyi ve eksik|yeniden yaz|düzenle|çevir|ingilizce|türkçe|paragraf|giriş|sonuç|tartışma|hipotez|apa|kaynakça|summarize|summary|selected|these papers|review my|rewrite)/i.test(
          lower
        );

      const explicitlyAsksNewSearch =
        /(makale bul|makaleleri bul|makale ara|makaleleri ara|hakkında makale|konusunda makale|literatür tara|araştırma yap|find papers|search papers|look up papers)/i.test(
          lower
        ) ||
        (!refersToExistingOrAction &&
          userText.trim().length <= 120 &&
          /(araştır|tara)$/i.test(lower.trim()));

      let searchedNewTopic = false;
      if (
        !noSearch &&
        !isPreset &&
        explicitlyAsksNewSearch &&
        !refersToExistingOrAction &&
        userText.trim().length <= 200
      ) {
        const coreSubject = window.ScholarAPI.extractCoreSubject(userText);
        if (coreSubject && coreSubject.length >= 2 && coreSubject.toLowerCase() !== state.query.toLowerCase()) {
          const searchInput = document.getElementById('searchInput');
          if (searchInput) searchInput.value = coreSubject;
          await runSearch(coreSubject);
          searchedNewTopic = true;
        }
      }

      // Build active context: prioritize user's selected papers unless a brand new search was just run
      const usingSelected = state.selectedPapers.length > 0 && !searchedNewTopic;
      const activePapers = usingSelected
        ? state.selectedPapers
        : state.filteredPapers.slice(0, 6);

      const bibliographyContext = activePapers
        .slice(0, 8)
        .map((p, idx) => {
          const inText = window.ScholarAPI.formatInTextCitation(p, 'APA7', idx + 1);
          const fullApa = window.ScholarAPI.formatCitation(p, 'APA7', idx + 1);
          return `[Paper ${idx + 1}] Title: ${p.title} | In-Text: ${inText} | Citations: ${
            p.scite?.total || 0
          }\nAbstract/Findings: ${p.abstract || p.insights?.keyFindings || ''}\nFull APA 7: ${fullApa}`;
        })
        .join('\n\n');

      const currentEditorDraft = (document.getElementById('editorTextarea')?.value || '').trim();
      const asksAboutDraft =
        isAudit || /(taslağ|yazım|editör|metnimi|metni denetle|draft|essay|peer-review)/i.test(lower);

      // Detect if English response should be enforced
      const wantsEnglish =
        forceLanguage === 'en' ||
        (/(in english|ingilizce|english)/i.test(lower) && !/(türkçe)/i.test(lower)) ||
        (!forceLanguage &&
          !/[çğıöşüÇĞİÖŞÜ]/.test(userText) &&
          /\b(the|and|with|for|this|that|please|summarize|review|essay|article|papers)\b/i.test(userText));

      const systemInstruction = wantsEnglish
        ? window.ScholarAI.HARVARD_PROFESSOR_SYSTEM_PROMPT_EN
        : window.ScholarAI.HARVARD_PROFESSOR_SYSTEM_PROMPT;

      const draftSection =
        asksAboutDraft && currentEditorDraft && !userText.includes(currentEditorDraft.slice(0, 80))
          ? `\n3. Current Writing Studio Draft:\n"""\n${currentEditorDraft.slice(0, 3500)}\n"""`
          : '';

      const promptWithContext = wantsEnglish
        ? `User Request:
${userText}

---
ACTIVE WORKSPACE CONTEXT (Use ONLY these real papers if summarizing/citing):
1. Active Research Topic: "${state.query}"
2. ${usingSelected ? 'USER-SELECTED PAPERS (Prioritize these!)' : 'Currently Listed Papers (Sorted by Citations)'}:
${bibliographyContext || 'No papers loaded yet.'}${draftSection}
---
INSTRUCTION: Respond STRICTLY in Academic English. Directly answer the user's request. If summarizing papers, synthesize ONLY the papers listed above with APA 7 in-text citations (Author, Year) and an APA 7 References list at the end.`
        : `Kullanıcı Mesajı:
${userText}

---
AKTİF ÇALIŞMA ALANI BAĞLAMI (Özetleme veya atıf isteniyorsa SADECE aşağıdaki gerçek makaleleri kullan):
1. Aktif Araştırma Konusu: "${state.query}"
2. ${usingSelected ? 'KULLANICININ SEÇTİĞİ MAKALELER (Öncelikle bunları kullan!)' : 'Ekranda Listelenen Gerçek Akademik Makaleler (Atıf Gücüne Göre Sıralı)'}:
${bibliographyContext || 'Henüz makale yok.'}${draftSection}
---
YÖNERGE: Kullanıcının isteğine doğrudan ve önceki sohbet bağlamını koruyarak yanıt ver. Sadece yukarıdaki gerçek makaleleri veya kullanıcının verdiği metni kullan; asla konu dışı başka bir metin uydurma. İlgili yerlerde APA 7 formatında (Yazar, Yıl) atıf ver ve sonunda APA 7 Kaynakça ekle.`;

      const aiRes = await window.ScholarAI.generateAcademicResponse({
        prompt: promptWithContext,
        history: isAudit ? [] : state.chatHistory,
        systemInstruction
      });

      // Save clean conversational turn into multi-turn memory
      state.chatHistory.push({ role: 'user', content: displayUserText });
      state.chatHistory.push({ role: 'assistant', content: aiRes.text });

      const shouldAttachPapers =
        searchedNewTopic ||
        showUsedPapers ||
        (!isAudit && /(özet|sentez|karşılaştır|makale|seçili|seçtiğ|listelenen|summarize|papers)/i.test(lower));

      appendChatBubble('assistant', aiRes.text, shouldAttachPapers ? activePapers : []);
    } catch (err) {
      appendChatBubble('assistant', `Üzgünüm, yanıt oluşturulurken bir hata oluştu: ${err.message}`);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Gönder →';
      }
    }
  }

  // Local PDF Upload
  async function handlePdfUpload(event) {
    const file = event.target?.files?.[0];
    if (!file) return;
    toast(`"${file.name}" okunuyor...`);

    try {
      let extracted = '';
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        const buf = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
        const pages = [];
        for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) {
          const p = await pdf.getPage(i);
          const c = await p.getTextContent();
          pages.push(c.items.map((x) => x.str).join(' '));
        }
        extracted = pages.join('\n').replace(/\s+/g, ' ').trim();
      }

      const title = file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ');
      const paper = {
        id: `pdf-${Date.now()}`,
        source: 'Yerel PDF',
        title,
        authors: ['PDF Kaynağı'],
        year: new Date().getFullYear(),
        venue: 'Yüklenen PDF',
        doi: '',
        url: '',
        pdfUrl: URL.createObjectURL(file),
        isOpenAccess: true,
        citationCount: 1,
        abstract: extracted.slice(0, 2000) || title,
        relevanceScore: 99
      };
      paper.insights = window.ScholarAPI.extractStructuredInsights(paper);
      paper.scite = window.ScholarAPI.buildSciteMetrics(paper, paper.insights);

      state.allPapers.unshift(paper);
      state.filteredPapers.unshift(paper);
      state.selectedPapers.unshift(paper);
      updateBadges();
      renderResults();
      openPaperDrawer(paper.id);
      toast(`"${title}" eklendi.`);
    } catch (e) {
      toast('PDF okunamadı.');
    }
  }

  async function init() {
    initTheme();
    updateFooterAiStatus();
    restoreSelectedState();
    restoreDraftFromStorage();
    onEditorChange();
    updateBadges();

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closePaperDrawer();
        toggleChatDrawer(false);
        closeGeminiSettings();
      }
    });

    appendChatBubble(
      'assistant',
      'Merhaba. Araştırmak istediğiniz herhangi bir konuyu yazabilir, seçtiğiniz makaleleri özetletebilir veya tez/makale taslağınızı YÖK ve uluslararası Q1 dergi standartlarında denetletebilirsiniz.'
    );

    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';

    const metaEl = document.getElementById('searchMetaLine');
    if (metaEl) metaEl.textContent = 'ARAMA YAPMAYA HAZIR';

    const listEl = document.getElementById('resultsList');
    if (listEl) {
      listEl.innerHTML = `<div class="py-16 text-center text-sm" style="color: var(--text-muted);">Araştırmak istediğiniz konuyu, kavramı veya makale başlığını yukarıya yazıp <strong>Araştır</strong>'a tıklayın.</div>`;
    }
  }

  return {
    init,
    toast,
    toggleTheme,
    openGeminiSettings,
    closeGeminiSettings,
    saveGeminiSettings,
    clearGeminiSettings,
    switchView,
    handleSearchSubmit,
    applyFilters,
    toggleSelect,
    clearSelectedPapers,
    openPaperDrawer,
    closePaperDrawer,
    copyPaperCitation,
    aiSummarizePaperInDrawer,
    citePaperAndGoStudio,
    loadTemplate,
    clearEditor,
    onEditorChange,
    onStyleChange,
    insertCitationToEditor,
    updateBibliography,
    appendBibliographyToText,
    copyBibliography,
    auditEditorWithAI,
    copyAuditReport,
    applyAuditRewrite,
    undoAuditRewrite,
    exportDoc,
    toggleChatDrawer,
    clearChat,
    quickAskAssistantOnResults,
    askAssistantPreset,
    handleChatSubmit,
    handlePdfUpload
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  window.App.init();
});
