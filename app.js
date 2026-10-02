(function () {
  'use strict';

  const PAGE_KEY = 'pp2026_chat_page';
  const DAY_KEY = 'pp2026_chat_day';
  const MODE_KEY = 'pp2026_chat_mode';
  const MAX_RESULTS = 80;

  const app = document.getElementById('app');
  const chat = document.getElementById('chat');
  const metaLine = document.getElementById('meta-line');
  const searchInput = document.getElementById('search');
  const searchBtn = document.getElementById('search-btn');
  const searchResults = document.getElementById('search-results');
  const showThink = document.getElementById('show-think');
  const pagerTop = document.getElementById('pager-top');
  const pagerBottom = document.getElementById('pager-bottom');
  const modePageBtn = document.getElementById('mode-page');
  const modeDayBtn = document.getElementById('mode-day');
  const logoutBtn = document.getElementById('logout');
  if (logoutBtn) logoutBtn.style.display = 'none';

  let meta = null;
  let browseMode = 'page'; // 'page' | 'day'
  let currentPage = 1;
  let currentDay = 1;
  let currentTurns = [];
  let searchIndex = null;
  let searchIndexPromise = null;
  let pendingHighlight = null; // { n, q }
  let lastSearchQ = '';

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function highlight(text, q) {
    const safe = esc(text);
    if (!q) return safe;
    const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    return safe.replace(re, '<mark class="mark">$1</mark>');
  }

  function totalUnits() {
    if (!meta) return 1;
    return browseMode === 'day' ? (meta.totalDays || (meta.days && meta.days.length) || 1) : meta.pages;
  }

  function currentUnit() {
    return browseMode === 'day' ? currentDay : currentPage;
  }

  function updateModeButtons() {
    if (modePageBtn) modePageBtn.classList.toggle('active', browseMode === 'page');
    if (modeDayBtn) modeDayBtn.classList.toggle('active', browseMode === 'day');
  }

  function renderPager(el) {
    if (!meta) return;
    const total = totalUnits();
    const cur = currentUnit();
    const zhLabel = browseMode === 'day' ? '第' + cur + '天 / 共' + total + '天' : 'Page ' + cur + ' / ' + total;
    const parts = [];
    parts.push('<button type="button" data-go="prev"' + (cur <= 1 ? ' disabled' : '') + '>‹ Prev</button>');
    parts.push('<span class="page-label">' + zhLabel + '</span>');
    const windowSize = 5;
    let start = Math.max(1, cur - Math.floor(windowSize / 2));
    let end = Math.min(total, start + windowSize - 1);
    start = Math.max(1, end - windowSize + 1);
    if (start > 1) {
      parts.push('<button type="button" data-unit="1">1</button>');
      if (start > 2) parts.push('<span class="page-label">…</span>');
    }
    for (let i = start; i <= end; i++) {
      parts.push('<button type="button" data-unit="' + i + '"' + (i === cur ? ' class="active"' : '') + '>' + i + '</button>');
    }
    if (end < total) {
      if (end < total - 1) parts.push('<span class="page-label">…</span>');
      parts.push('<button type="button" data-unit="' + total + '">' + total + '</button>');
    }
    parts.push('<button type="button" data-go="next"' + (cur >= total ? ' disabled' : '') + '>Next ›</button>');
    el.innerHTML = parts.join('');
    el.onclick = (ev) => {
      const btn = ev.target.closest('button');
      if (!btn || btn.disabled) return;
      if (btn.dataset.unit) goUnit(parseInt(btn.dataset.unit, 10));
      else if (btn.dataset.go === 'prev') goUnit(cur - 1);
      else if (btn.dataset.go === 'next') goUnit(cur + 1);
    };
  }

  function renderChat() {
    const q = lastSearchQ || '';
    const thinkOn = !showThink || showThink.checked;
    const frag = document.createDocumentFragment();
    let shown = 0;
    let prevDay = null;
    const showDayDividers = browseMode === 'page';

    for (const t of currentTurns) {
      shown++;
      const day = t.day || 1;

      if (showDayDividers) {
        if (prevDay !== null && day !== prevDay) {
          const div = document.createElement('div');
          div.className = 'day-divider';
          div.setAttribute('role', 'separator');
          div.innerHTML = '<span>第' + day + '天</span>';
          frag.appendChild(div);
        } else if (prevDay === null && shown === 1) {
          const div = document.createElement('div');
          div.className = 'day-divider day-divider-page';
          div.setAttribute('role', 'separator');
          div.innerHTML = '<span>第' + day + '天</span>';
          frag.appendChild(div);
        }
      } else if (shown === 1) {
        const div = document.createElement('div');
        div.className = 'day-divider day-divider-page';
        div.setAttribute('role', 'separator');
        div.innerHTML = '<span>第' + day + '天</span>';
        frag.appendChild(div);
      }
      prevDay = day;

      const turn = document.createElement('article');
      turn.className = 'turn';
      turn.id = 'turn-' + t.n;
      turn.dataset.day = String(day);

      const head = document.createElement('div');
      head.className = 'turn-head';
      head.textContent = '第' + day + '天 · Turn ' + t.n;
      turn.appendChild(head);

      if (t.user) {
        const row = document.createElement('div');
        row.className = 'row me';
        const b = document.createElement('div');
        b.className = 'bubble me';
        b.innerHTML = '<span class="label">（我）</span>' + highlight(t.user, q);
        row.appendChild(b);
        turn.appendChild(row);
      }

      if (t.think && thinkOn) {
        const row = document.createElement('div');
        row.className = 'row peter';
        const box = document.createElement('div');
        box.className = 'think think-open';
        box.innerHTML = '<div class="think-label">（心裡面）</div><div class="think-body">' + highlight(t.think, q) + '</div>';
        row.appendChild(box);
        turn.appendChild(row);
      }

      if (t.assistant) {
        const row = document.createElement('div');
        row.className = 'row peter';
        const b = document.createElement('div');
        b.className = 'bubble peter';
        b.innerHTML = '<span class="label">（Peter）</span>' + highlight(t.assistant, q);
        row.appendChild(b);
        turn.appendChild(row);
      }

      frag.appendChild(turn);
    }

    chat.innerHTML = '';
    if (shown === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = browseMode === 'day' ? '這一天沒有對話。' : '本頁沒有對話。';
      chat.appendChild(empty);
    } else {
      chat.appendChild(frag);
    }

    if (pendingHighlight) {
      const targetN = pendingHighlight.n;
      pendingHighlight = null;
      requestAnimationFrame(() => {
        const el = document.getElementById('turn-' + targetN);
        if (!el) return;
        el.classList.add('turn-flash');
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(() => el.classList.remove('turn-flash'), 2200);
      });
    }
  }

  function updateMetaLine() {
    if (!meta) return;
    if (browseMode === 'day') {
      const info = (meta.days || []).find((d) => d.day === currentDay);
      const count = info ? info.turns : currentTurns.length;
      const range = info
        ? ('Turn ' + info.firstTurn + '–' + info.lastTurn)
        : (currentTurns.length
          ? ('Turn ' + currentTurns[0].n + '–' + currentTurns[currentTurns.length - 1].n)
          : '');
      metaLine.textContent =
        meta.totalTurns + ' turns · ' + meta.totalDays + ' days · 第' + currentDay + '天 · ' +
        count + ' turns' + (range ? ' · ' + range : '');
    } else {
      const start = (currentPage - 1) * meta.pageSize + 1;
      const end = Math.min(currentPage * meta.pageSize, meta.totalTurns);
      const daysLabel = meta.totalDays ? (' · ' + meta.totalDays + ' days') : '';
      metaLine.textContent =
        meta.totalTurns + ' turns' + daysLabel + ' · showing ' + start + '–' + end +
        ' · page ' + currentPage + '/' + meta.pages;
    }
  }

  async function goPage(n, opts) {
    if (!meta) return;
    n = Math.max(1, Math.min(meta.pages, n));
    currentPage = n;
    sessionStorage.setItem(PAGE_KEY, String(n));
    chat.innerHTML = '<div class="loading">Loading…</div>';
    renderPager(pagerTop);
    renderPager(pagerBottom);

    const pad = String(n).padStart(3, '0');
    const res = await fetch('data/page-' + pad + '.json');
    if (!res.ok) {
      chat.innerHTML = '<div class="empty">Failed to load page ' + n + '</div>';
      return;
    }
    currentTurns = await res.json();
    updateMetaLine();
    renderChat();
    if (!(opts && opts.skipScroll)) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  async function goDay(n, opts) {
    if (!meta) return;
    const total = meta.totalDays || (meta.days && meta.days.length) || 1;
    n = Math.max(1, Math.min(total, n));
    currentDay = n;
    sessionStorage.setItem(DAY_KEY, String(n));
    chat.innerHTML = '<div class="loading">Loading…</div>';
    renderPager(pagerTop);
    renderPager(pagerBottom);

    const pad = String(n).padStart(3, '0');
    const res = await fetch('data/day-' + pad + '.json');
    if (!res.ok) {
      chat.innerHTML = '<div class="empty">無法載入第' + n + '天</div>';
      return;
    }
    currentTurns = await res.json();
    updateMetaLine();
    renderChat();
    if (!(opts && opts.skipScroll)) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function goUnit(n, opts) {
    if (browseMode === 'day') return goDay(n, opts);
    return goPage(n, opts);
  }

  function setMode(mode) {
    if (mode !== 'page' && mode !== 'day') return;
    if (browseMode === mode) return;
    browseMode = mode;
    sessionStorage.setItem(MODE_KEY, mode);
    updateModeButtons();
    goUnit(currentUnit());
  }

  function loadSearchIndex() {
    if (searchIndex) return Promise.resolve(searchIndex);
    if (searchIndexPromise) return searchIndexPromise;
    searchIndexPromise = fetch('data/search-index.json')
      .then((res) => {
        if (!res.ok) throw new Error('search-index ' + res.status);
        return res.json();
      })
      .then((data) => {
        searchIndex = data;
        return data;
      })
      .catch((err) => {
        searchIndexPromise = null;
        throw err;
      });
    return searchIndexPromise;
  }

  function snippetAround(text, q, radius) {
    const lower = text.toLowerCase();
    const ql = q.toLowerCase();
    const idx = lower.indexOf(ql);
    if (idx < 0) {
      const s = text.replace(/\s+/g, ' ').trim();
      return s.length > 90 ? s.slice(0, 90) + '…' : s;
    }
    const start = Math.max(0, idx - radius);
    const end = Math.min(text.length, idx + q.length + radius);
    let snip = text.slice(start, end).replace(/\s+/g, ' ').trim();
    if (start > 0) snip = '…' + snip;
    if (end < text.length) snip = snip + '…';
    return snip;
  }

  function hideSearchResults() {
    if (!searchResults) return;
    searchResults.hidden = true;
    searchResults.innerHTML = '';
  }

  function showSearchResults(html) {
    if (!searchResults) return;
    searchResults.innerHTML = html;
    searchResults.hidden = false;
  }

  async function runFullSearch() {
    const q = (searchInput && searchInput.value || '').trim();
    if (!q) {
      lastSearchQ = '';
      hideSearchResults();
      renderChat();
      return;
    }
    lastSearchQ = q;
    showSearchResults('<div class="search-status">搜尋中…</div>');
    try {
      const data = await loadSearchIndex();
      const ql = q.toLowerCase();
      const hits = [];
      for (const item of data.items) {
        if ((item.text || '').toLowerCase().includes(ql)) {
          hits.push(item);
          if (hits.length >= MAX_RESULTS) break;
        }
      }
      if (hits.length === 0) {
        showSearchResults('<div class="search-status">全站沒有符合「' + esc(q) + '」的結果。</div>');
        renderChat();
        return;
      }
      const more = hits.length >= MAX_RESULTS
        ? '<div class="search-status">顯示前 ' + MAX_RESULTS + ' 筆，請縮小關鍵字。</div>'
        : '';
      const list = hits.map((item) => {
        const snip = snippetAround(item.text || item.snip || '', q, 36);
        return (
          '<button type="button" class="search-hit" role="option" data-n="' + item.n +
          '" data-day="' + item.day + '" data-page="' + item.page + '">' +
          '<span class="search-hit-meta">第' + item.day + '天 · Turn ' + item.n +
          (browseMode === 'page' ? ' · p.' + item.page : '') + '</span>' +
          '<span class="search-hit-snip">' + highlight(snip, q) + '</span>' +
          '</button>'
        );
      }).join('');
      showSearchResults(
        '<div class="search-status">找到 ' + hits.length +
        (hits.length >= MAX_RESULTS ? '+' : '') + ' 筆</div>' + list + more
      );
      renderChat();
    } catch (e) {
      console.error(e);
      showSearchResults('<div class="search-status">搜尋索引載入失敗。</div>');
    }
  }

  async function jumpToHit(n, day, page) {
    hideSearchResults();
    pendingHighlight = { n: n, q: lastSearchQ };
    if (browseMode === 'day') {
      if (day === currentDay && currentTurns.some((t) => t.n === n)) {
        renderChat();
        return;
      }
      await goDay(day, { skipScroll: true });
    } else {
      if (page === currentPage && currentTurns.some((t) => t.n === n)) {
        renderChat();
        return;
      }
      await goPage(page, { skipScroll: true });
    }
  }

  if (modePageBtn) modePageBtn.addEventListener('click', () => setMode('page'));
  if (modeDayBtn) modeDayBtn.addEventListener('click', () => setMode('day'));
  if (showThink) showThink.addEventListener('change', () => renderChat());

  if (searchBtn) searchBtn.addEventListener('click', () => runFullSearch());
  if (searchInput) {
    searchInput.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        runFullSearch();
      } else if (ev.key === 'Escape') {
        hideSearchResults();
      }
    });
    searchInput.addEventListener('input', () => {
      if (!(searchInput.value || '').trim()) {
        lastSearchQ = '';
        hideSearchResults();
        renderChat();
      }
    });
  }
  if (searchResults) {
    searchResults.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.search-hit');
      if (!btn) return;
      const n = parseInt(btn.dataset.n, 10);
      const day = parseInt(btn.dataset.day, 10);
      const page = parseInt(btn.dataset.page, 10);
      jumpToHit(n, day, page);
    });
  }
  document.addEventListener('click', (ev) => {
    if (!searchResults || searchResults.hidden) return;
    const wrap = ev.target.closest('.search-wrap');
    if (!wrap) hideSearchResults();
  });

  async function boot() {
    try {
      if (location.protocol === 'file:') {
        chat.innerHTML = '<div class="empty">請用本機伺服器開啟：在資料夾執行 python3 -m http.server 8765，然後打開 http://127.0.0.1:8765/</div>';
        return;
      }
      const res = await fetch('data/meta.json');
      if (!res.ok) throw new Error('meta ' + res.status);
      meta = await res.json();
      const savedMode = sessionStorage.getItem(MODE_KEY);
      browseMode = savedMode === 'day' ? 'day' : 'page';
      updateModeButtons();
      if (searchInput) searchInput.placeholder = '搜尋全站關鍵字…';
      currentPage = parseInt(sessionStorage.getItem(PAGE_KEY) || '1', 10) || 1;
      currentDay = parseInt(sessionStorage.getItem(DAY_KEY) || '1', 10) || 1;
      // Prefetch search index in background
      loadSearchIndex().catch(() => {});
      goUnit(currentUnit());
    } catch (e) {
      chat.innerHTML = '<div class="empty">無法載入對話資料。請確認用 http://127.0.0.1:8765/ 開啟（不要雙擊 index.html）。</div>';
      console.error(e);
    }
  }
  boot();
})();
