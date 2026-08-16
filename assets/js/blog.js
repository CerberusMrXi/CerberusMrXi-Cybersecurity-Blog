/* ============================================================
   Blog Feed & Homepage | blog.js
   ============================================================ */

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'binary-exploitation', label: 'Binary' },
  { id: 'web', label: 'Web' },
  { id: 'tools', label: 'Tools' },
  { id: 'opsec', label: 'OPSEC' },
  { id: 'malware', label: 'Malware' },
  { id: 'ctf', label: 'CTF' },
];

let currentCategory = 'all';
let searchQuery = '';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str || ''));
  return div.innerHTML;
}

function renderPostCard(post, featured = false) {
  const tags = (post.tags || []).slice(0, 3).map(badgeHtml).join('');
  const card = document.createElement('article');
  card.className = `post-card${featured ? ' post-card--featured' : ''}`;
  card.setAttribute('data-id', post.id);
  card.tabIndex = 0;
  card.setAttribute('role', 'link');

  const imageHtml = post.coverImage
    ? `<div class="post-card__img" style="height:180px;overflow:hidden"><img src="${escapeHtml(post.coverImage)}" alt="${escapeHtml(post.title)}" style="width:100%;height:100%;object-fit:cover" /></div>`
    : '';

  card.innerHTML = `
    ${imageHtml}
    <div class="post-card__mark" aria-hidden="true">
      <span class="post-card__glyph">${post.emoji || '◆'}</span>
      <span class="post-card__cat">${escapeHtml(post.category || post.type || 'post')}</span>
    </div>
    <div class="post-card__body">
      <div class="post-card__meta">
        ${tags}
        <span class="post-card__date">${formatDate(post.date)}</span>
      </div>
      <h2 class="post-card__title">${escapeHtml(post.title)}</h2>
      <p class="post-card__excerpt">${escapeHtml(post.excerpt || '')}</p>
      <div class="post-card__footer">
        <span class="post-card__readtime">${post.readTime || 5} min read</span>
        <span class="post-card__read-btn">Read →</span>
      </div>
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

function filterPosts() {
  let posts = PostsDB.getPosts();

  if (currentCategory !== 'all') {
    posts = posts.filter(
      (p) =>
        (p.category || '').toLowerCase() === currentCategory ||
        (p.tags || []).map((t) => t.toLowerCase()).includes(currentCategory)
    );
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    posts = posts.filter(
      (p) =>
        (p.title || '').toLowerCase().includes(q) ||
        (p.excerpt || '').toLowerCase().includes(q) ||
        (p.tags || []).some((t) => t.toLowerCase().includes(q)) ||
        (p.category || '').toLowerCase().includes(q)
    );
  }

  return posts.sort((a, b) => +new Date(b.date) - +new Date(a.date));
}

function renderPosts() {
  const grid = document.getElementById('post-grid');
  if (!grid) return;

  const posts = filterPosts();
  grid.innerHTML = '';

  if (posts.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">◇</div>
        <h3>No posts found</h3>
        <p>${searchQuery ? `No results for “${escapeHtml(searchQuery)}”` : 'No posts in this category yet.'}</p>
      </div>
    `;
    return;
  }

  const showFeatured = !searchQuery && currentCategory === 'all';
  const featuredId = showFeatured
    ? (PostsDB.getFeatured().find((p) => p.type !== 'ctf') || posts[0])?.id
    : null;

  posts.forEach((post) => {
    grid.appendChild(renderPostCard(post, showFeatured && post.id === featuredId));
  });
}

function initFilters() {
  const container = document.getElementById('filter-tags');
  if (!container) return;

  CATEGORIES.forEach((cat) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `filter-tag${cat.id === 'all' ? ' active' : ''}`;
    btn.textContent = cat.label;
    btn.setAttribute('data-cat', cat.id);
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-tag').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentCategory = cat.id;
      renderPosts();
    });
    container.appendChild(btn);
  });
}

function initSearch() {
  const input = document.getElementById('search-input');
  if (!input) return;

  let debounce;
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      searchQuery = input.value.trim();
      renderPosts();
    }, 250);
  });
}

function initHeroStats() {
  const posts = PostsDB.getPosts();
  const ctfs = PostsDB.getCTFs();

  const statPosts = document.getElementById('stat-posts');
  const statCtfs = document.getElementById('stat-ctfs');

  const run = () => {
    if (statPosts) animateCounter(statPosts, posts.length);
    if (statCtfs) animateCounter(statCtfs, ctfs.length);
  };

  const statsEl = document.querySelector('.signal-strip');
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
    { threshold: 0.2 }
  );
  observer.observe(statsEl);
}

function startBlog() {
  initFilters();
  initSearch();
  renderPosts();
  initHeroStats();
  initMatrix('matrix-canvas');
  initTyping(
    'typing-text',
    [
      'Exploit developer',
      'Security researcher',
      'CTF writeups',
      'CVE PoC author',
    ],
    70
  );

  const hero = document.querySelector('.hero');
  if (hero) requestAnimationFrame(() => hero.classList.add('hero--ready'));
}

document.addEventListener('DOMContentLoaded', () => {
  if (PostsDB._cache?.length) startBlog();
  else document.addEventListener('postsdb:ready', startBlog, { once: true });
});
