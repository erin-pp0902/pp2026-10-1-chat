(function () {
  'use strict';

  const PAGE_KEY = 'pp2026_chat_page';

  const app = document.getElementById('app');
  const chat = document.getElementById('chat');
  const metaLine = document.getElementById('meta-line');
  const searchInput = document.getElementById('search');
  const showThink = document.getElementById('show-think');
  const pagerTop = document.getElementById('pager-top');
  const pagerBottom = document.getElementById('pager-bottom');
  const logoutBtn = document.getElementById('logout');
  if (logoutBtn) logoutBtn.style.display = 'none';

  let meta = null;
  let currentPage = 1;
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

  function renderPager(el) {
    if (!meta) return;
    const pages = meta.pages;
    const parts = [];
    parts.push('<button type="button" data-go="prev"' + (currentPage <= 1 ? ' disabled' : '') + '>‹ Prev</button>');
    parts.push('<span class="page-label">Page ' + currentPage + ' / ' + pages + '</span>');
    const windowSize = 5;
    let start = Math.max(1, currentPage - Math.floor(windowSize / 2));
    let end = Math.min(pages, start + windowSize - 1);
    start = Math.max(1, end - windowSize + 1);
    if (start > 1) {
      parts.push('<button type="button" data-page="1">1</button>');
      if (start > 2) parts.push('<span class="page-label">…</span>');
    }
    for (let i = start; i <= end; i++) {
      parts.push('<button type="button" data-page="' + i + '"' + (i === currentPage ? ' class="active"' : '') + '>' + i + '</button>');
    }
    if (end < pages) {
      if (end < pages - 1) parts.push('<span class="page-label">…</span>');
      parts.push('<button type="button" data-page="' + pages + '">' + pages + '</button>');
    }
    parts.push('<button type="button" data-go="next"' + (currentPage >= pages ? ' disabled' : '') + '>Next ›</button>');
    el.innerHTML = parts.join('');
    el.onclick = (ev) => {
      const btn = ev.target.closest('button');
      if (!btn || btn.disabled) return;
      if (btn.dataset.page) goPage(parseInt(btn.dataset.page, 10));
      else if (btn.dataset.go === 'prev') goPage(currentPage - 1);
      else if (btn.dataset.go === 'next') goPage(currentPage + 1);
    };
  }

  function renderChat() {
    const q = (searchInput && searchInput.value || '').trim();
    const thinkOn = !showThink || showThink.checked;
    const frag = document.createDocumentFragment();
    let shown = 0;
    let prevDay = null;

    for (const t of currentTurns) {
      if (q) {
        const hay = (t.user + '\n' + t.think + '\n' + t.assistant).toLowerCase();
        if (!hay.includes(q.toLowerCase())) continue;
      }
      shown++;
      const day = t.day || 1;

      if (prevDay !== null && day !== prevDay) {
        const div = document.createElement('div');
        div.className = 'day-divider';
        div.setAttribute('role', 'separator');
        div.innerHTML = '<span>第' + day + '天</span>';
        frag.appendChild(div);
      } else if (prevDay === null && shown === 1) {
        // Sticky-style marker at top of page when this page continues a day,
        // and whenever the first visible turn begins a day.
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
      empty.textContent = q ? 'No matches on this page.' : 'No turns on this page.';
      chat.appendChild(empty);
    } else {
      chat.appendChild(frag);
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
    const start = (n - 1) * meta.pageSize + 1;
    const end = Math.min(n * meta.pageSize, meta.totalTurns);
    const daysLabel = meta.totalDays ? (' · ' + meta.totalDays + ' days') : '';
    metaLine.textContent = meta.totalTurns + ' turns' + daysLabel + ' · showing ' + start + '–' + end + ' · page ' + n + '/' + meta.pages;
    renderChat();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

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
      const saved = parseInt(sessionStorage.getItem(PAGE_KEY) || '1', 10);
      goPage(saved || 1);
    } catch (e) {
      chat.innerHTML = '<div class="empty">無法載入對話資料。請確認用 http://127.0.0.1:8765/ 開啟（不要雙擊 index.html）。</div>';
      console.error(e);
    }
  }
  boot();
})();
