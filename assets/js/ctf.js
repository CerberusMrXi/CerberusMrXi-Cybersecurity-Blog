/* ============================================================
   CTF Writeups Page | ctf.js
   ============================================================ */

const CTF_PLATFORMS = [
  { id: 'all', label: 'All' },
  { id: 'HackTheBox', label: 'HackTheBox' },
  { id: 'TryHackMe', label: 'TryHackMe' },
  { id: 'PicoCTF', label: 'PicoCTF' },
  { id: 'Other', label: 'Other' },
];

const CTF_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'web', label: 'Web' },
  { id: 'pwn', label: 'Pwn' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'reverse', label: 'Reverse' },
  { id: 'forensics', label: 'Forensics' },
  { id: 'linux', label: 'Linux' },
];

let ctfPlatform = 'all';
let ctfCategory = 'all';
let ctfSearch = '';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str || ''));
  return div.innerHTML;
}

function renderCTFCard(post) {
  const diff = (post.difficulty || 'medium').toLowerCase();
  const tags = (post.tags || [])
    .slice(0, 3)
    .map((t) => `<span class="badge badge--${tagColor(t)}">${t}</span>`)
    .join('');

  const card = document.createElement('article');
  card.className = 'ctf-card';
  card.setAttribute('data-id', post.id);
  card.tabIndex = 0;
  card.setAttribute('role', 'link');

  card.innerHTML = `
    <div class="ctf-card__header">
      <span class="ctf-card__platform">${escapeHtml(post.platform || 'CTF')}</span>
      <span class="badge diff--${diff}">${escapeHtml(post.difficulty || 'Medium')}</span>
    </div>
    <h3 class="ctf-card__title">${escapeHtml(post.title)}</h3>
    <p class="ctf-card__desc">${escapeHtml(post.excerpt || '')}</p>
    <div class="ctf-card__tags">${tags}</div>
    <div class="ctf-card__footer">
      <span class="ctf-card__points">${post.points || 0} pts</span>
      <span class="ctf-card__go">Writeup →</span>
    </div>
  `;

  const go = () => {
    window.location.href = `post.html?id=${encodeURIComponent(post.id)}`;
  };
  card.addEventListener('click', go);
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      go();
    }
  });

  return card;
}

function filterCTFs() {
  let posts = PostsDB.getCTFs();

  if (ctfPlatform !== 'all') {
    posts = posts.filter(
      (p) => (p.platform || '').toLowerCase() === ctfPlatform.toLowerCase()
    );
  }

  if (ctfCategory !== 'all') {
    posts = posts.filter(
      (p) =>
        (p.tags || []).map((t) => t.toLowerCase()).includes(ctfCategory) ||
        (p.category || '').toLowerCase() === ctfCategory
    );
  }

  if (ctfSearch) {
    const q = ctfSearch.toLowerCase();
    posts = posts.filter(
      (p) =>
        (p.title || '').toLowerCase().includes(q) ||
        (p.excerpt || '').toLowerCase().includes(q) ||
        (p.platform || '').toLowerCase().includes(q) ||
        (p.tags || []).some((t) => t.toLowerCase().includes(q))
    );
  }

  return posts.sort((a, b) => +new Date(b.date) - +new Date(a.date));
}

function renderCTFs() {
  const grid = document.getElementById('ctf-grid');
  if (!grid) return;

  const posts = filterCTFs();
  grid.innerHTML = '';

  if (posts.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">⚑</div>
        <h3>No writeups found</h3>
        <p>${ctfSearch ? `No results for “${escapeHtml(ctfSearch)}”` : 'No CTF writeups here yet.'}</p>
      </div>
    `;
    return;
  }

  posts.forEach((post) => grid.appendChild(renderCTFCard(post)));
}

function renderCTFStats() {
  const all = PostsDB.getCTFs();
  const totalPoints = all.reduce((sum, p) => sum + (p.points || 0), 0);
  const platforms = new Set(all.map((p) => p.platform).filter(Boolean)).size;

  const elCount = document.getElementById('ctf-count');
  const elPoints = document.getElementById('ctf-points');
  const elPlats = document.getElementById('ctf-platforms');

  const run = () => {
    if (elCount) animateCounter(elCount, all.length);
    if (elPoints) animateCounter(elPoints, totalPoints);
    if (elPlats) animateCounter(elPlats, platforms);
  };

  const statsEl = document.querySelector('.ctf-stats');
  if (!statsEl) {
    run();
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          run();
          observer.disconnect();
        }
      });
    },
    { threshold: 0.3 }
  );
  observer.observe(statsEl);
}

function bindFilterGroup(containerId, items, onPick) {
  const container = document.getElementById(containerId);
  if (!container) return;

  items.forEach((item, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `filter-tag${i === 0 ? ' active' : ''}`;
    btn.textContent = item.label;
    btn.addEventListener('click', () => {
      container.querySelectorAll('.filter-tag').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      onPick(item.id);
      renderCTFs();
    });
    container.appendChild(btn);
  });
}

function initCTFSearch() {
  const input = document.getElementById('ctf-search');
  if (!input) return;
  let debounce;
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      ctfSearch = input.value.trim();
      renderCTFs();
    }, 250);
  });
}

function startCTF() {
  bindFilterGroup('platform-filter', CTF_PLATFORMS, (id) => {
    ctfPlatform = id;
  });
  bindFilterGroup('category-filter', CTF_CATEGORIES, (id) => {
    ctfCategory = id;
  });
  initCTFSearch();
  renderCTFs();
  renderCTFStats();
}

document.addEventListener('DOMContentLoaded', () => {
  if (PostsDB._cache?.length) startCTF();
  else document.addEventListener('postsdb:ready', startCTF, { once: true });
});
