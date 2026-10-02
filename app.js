(function () {
  'use strict';

  const PAGE_KEY = 'pp2026_chat_page';
  const DAY_KEY = 'pp2026_chat_day';
  const MODE_KEY = 'pp2026_chat_mode';

  const app = document.getElementById('app');
  const chat = document.getElementById('chat');
  const metaLine = document.getElementById('meta-line');
  const searchInput = document.getElementById('search');
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
    const label = browseMode === 'day' ? 'Day' : 'Page';
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
    const q = (searchInput && searchInput.value || '').trim();
    const thinkOn = !showThink || showThink.checked;
    const frag = document.createDocumentFragment();
    let shown = 0;
    let prevDay = null;
    const showDayDividers = browseMode === 'page';

    for (const t of currentTurns) {
      if (q) {
        const hay = (t.user + '\n' + t.think + '\n' + t.assistant).toLowerCase();
        if (!hay.includes(q.toLowerCase())) continue;
      }
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
      empty.textContent = q
        ? (browseMode === 'day' ? '這一天沒有符合的結果。' : '本頁沒有符合的結果。')
        : (browseMode === 'day' ? '這一天沒有對話。' : '本頁沒有對話。');
      chat.appendChild(empty);
    } else {
      chat.appendChild(frag);
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

  async function goPage(n) {
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function goDay(n) {
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goUnit(n) {
    if (browseMode === 'day') return goDay(n);
    return goPage(n);
  }

  function setMode(mode) {
    if (mode !== 'page' && mode !== 'day') return;
    if (browseMode === mode) return;
    browseMode = mode;
    sessionStorage.setItem(MODE_KEY, mode);
    updateModeButtons();
    if (searchInput) searchInput.placeholder = mode === 'day' ? '搜尋這一天…' : '搜尋本頁…';
    goUnit(currentUnit());
  }

  if (modePageBtn) modePageBtn.addEventListener('click', () => setMode('page'));
  if (modeDayBtn) modeDayBtn.addEventListener('click', () => setMode('day'));
  if (searchInput) searchInput.addEventListener('input', () => renderChat());
  if (showThink) showThink.addEventListener('change', () => renderChat());

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
      if (searchInput) {
        searchInput.placeholder = browseMode === 'day' ? '搜尋這一天…' : '搜尋本頁…';
      }
      currentPage = parseInt(sessionStorage.getItem(PAGE_KEY) || '1', 10) || 1;
      currentDay = parseInt(sessionStorage.getItem(DAY_KEY) || '1', 10) || 1;
      goUnit(currentUnit());
    } catch (e) {
      chat.innerHTML = '<div class="empty">無法載入對話資料。請確認用 http://127.0.0.1:8765/ 開啟（不要雙擊 index.html）。</div>';
      console.error(e);
    }
  }
  boot();
})();
