/* ============================================================
   Shared Utilities & Storage API | main.js
   Public site: static assets/data/posts.json
   Admin: optional API → localStorage fallback
   ============================================================ */

const STORAGE_KEYS = {
  POSTS: 'sw_blog_posts',
  SESSION: 'sw_admin_session',
  LOCKOUT: 'sw_admin_lockout',
  ATTEMPTS: 'sw_admin_attempts',
  VIEWS: 'sw_post_views',
};

const PostsDB = {
  _cache: [],
  _mode: 'static',
  _ready: null,

  ready(admin = false) {
    if (!this._ready) this._ready = this.init(admin);
    return this._ready;
  },

  async init(admin = false) {
    // Prefer live API + MongoDB whenever health reports connected
    if (typeof BlogAPI !== 'undefined') {
      try {
        const online = await BlogAPI.checkHealth();
        if (online) {
          this._mode = 'api';
          await this.reload(admin);
          return this._mode;
        }
      } catch {
        /* fall through */
      }
    }

    // Public fallback: committed static JSON (works on GitHub Pages without backend)
    if (!admin) {
      const loaded = await this._loadStatic();
      if (loaded) return this._mode;
    }

    // Admin / last resort: localStorage seeded from static file
    this._mode = 'local';
    if (!localStorage.getItem(STORAGE_KEYS.POSTS)) {
      const staticPosts = await this._fetchStaticArray();
      localStorage.setItem(
        STORAGE_KEYS.POSTS,
        JSON.stringify(staticPosts.length ? staticPosts : [])
      );
    }
    this._cache = this._readLocal();
    return this._mode;
  },

  async _fetchStaticArray() {
    try {
      const url =
        typeof BLOG_CONFIG !== 'undefined'
          ? BLOG_CONFIG.dataUrl('posts.json')
          : 'assets/data/posts.json';
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },

  async _loadStatic() {
    const data = await this._fetchStaticArray();
    if (!data.length) return false;
    this._mode = 'static';
    this._cache = data.filter((p) => p.status === 'published');
    return true;
  },

  mode() {
    return this._mode;
  },

  isApiMode() {
    return this._mode === 'api';
  },

  async reload(admin = false) {
    if (this._mode === 'static') {
      await this._loadStatic();
      return this._cache;
    }
    if (this._mode !== 'api') {
      this._cache = this._readLocal();
      return this._cache;
    }
    this._cache = admin
      ? await BlogAPI.getAllPosts()
      : await BlogAPI.getPublishedPosts();
    return this._cache;
  },

  _readLocal() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.POSTS)) || [];
    } catch {
      return [];
    }
  },

  getAll() {
    return this._cache.length ? [...this._cache] : this._readLocal();
  },

  getById(id) {
    return this.getAll().find((p) => p.id === id || p._id === id) || null;
  },

  getPublished() {
    return this.getAll().filter((p) => p.status === 'published');
  },

  getPosts() {
    return this.getPublished().filter((p) => p.type === 'post' || !p.type);
  },

  getCTFs() {
    return this.getPublished().filter((p) => p.type === 'ctf');
  },

  getFeatured() {
    const featured = this.getPublished().filter((p) => p.featured);
    if (featured.length) return featured;
    return this.getPublished().slice(0, 1);
  },

  getRelated(post, limit = 3) {
    if (!post) return [];
    const others = this.getPublished().filter(
      (p) => p.id !== post.id && p._id !== post.id
    );
    const tags = new Set((post.tags || []).map((t) => t.toLowerCase()));
    const scored = others.map((p) => {
      let score = 0;
      if (p.category === post.category) score += 2;
      if (p.type === post.type) score += 1;
      (p.tags || []).forEach((t) => {
        if (tags.has(String(t).toLowerCase())) score += 2;
      });
      return { p, score };
    });
    scored.sort((a, b) => b.score - a.score || +new Date(b.p.date) - +new Date(a.p.date));
    return scored.slice(0, limit).map((x) => x.p);
  },

  getNeighbors(post) {
    const list = this.getPublished().sort(
      (a, b) => +new Date(b.date) - +new Date(a.date)
    );
    const idx = list.findIndex((p) => p.id === post.id || p._id === post.id);
    return {
      prev: idx > 0 ? list[idx - 1] : null,
      next: idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null,
    };
  },

  async save(post) {
    if (typeof BlogAPI !== 'undefined') {
      try {
        const online = await BlogAPI.checkHealth();
        if (online) {
          this._mode = 'api';
        }
      } catch {
        /* fallback to current mode */
      }
    }

    if (this._mode === 'api') {
      const saved = await BlogAPI.savePost(post);
      await this.reload(true);
      return saved;
    }

    const posts = this._readLocal();
    if (!post.id) post.id = 'post-' + Date.now();
    post.updatedAt = new Date().toISOString();
    const idx = posts.findIndex((p) => p.id === post.id);
    if (idx >= 0) posts[idx] = post;
    else {
      if (!post.date) post.date = new Date().toISOString().split('T')[0];
      if (!post.readTime) {
        post.readTime = Math.max(
          1,
          Math.ceil((post.content || '').split(/\s+/).length / 200)
        );
      }
      posts.unshift(post);
    }
    localStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(posts));
    this._cache = posts;
    return post;
  },

  async delete(id) {
    if (this._mode === 'api') {
      await BlogAPI.deletePost(id);
      await this.reload(true);
      return;
    }
    const posts = this._readLocal().filter((p) => p.id !== id);
    localStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(posts));
    this._cache = posts;
  },

  exportJSON() {
    return JSON.stringify(this.getAll(), null, 2);
  },

  async importJSON(jsonStr) {
    const data = JSON.parse(jsonStr);
    if (!Array.isArray(data)) throw new Error('Invalid format');

    if (this._mode === 'api') {
      const result = await BlogAPI.importPosts(data, true);
      await this.reload(true);
      return result.count;
    }

    localStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(data));
    this._cache = data;
    return data.length;
  },

  async incrementViews(id) {
    if (this._mode === 'api') {
      try {
        const result = await BlogAPI.incrementView(id);
        const post = this.getById(id);
        if (post) post.views = result.views;
        return result.views;
      } catch {
        return this.getViews(id);
      }
    }

    const views = JSON.parse(localStorage.getItem(STORAGE_KEYS.VIEWS) || '{}');
    views[id] = (views[id] || 0) + 1;
    localStorage.setItem(STORAGE_KEYS.VIEWS, JSON.stringify(views));
    return views[id];
  },

  getViews(id) {
    if (this._mode === 'api') {
      const post = this.getById(id);
      return post?.views || 0;
    }
    const views = JSON.parse(localStorage.getItem(STORAGE_KEYS.VIEWS) || '{}');
    return views[id] || 0;
  },

  getTotalViews() {
    if (this._mode === 'api') {
      return this.getAll().reduce((sum, p) => sum + (p.views || 0), 0);
    }
    const views = JSON.parse(localStorage.getItem(STORAGE_KEYS.VIEWS) || '{}');
    return Object.values(views).reduce((a, b) => a + b, 0);
  },
};

function initNav() {
  const nav = document.querySelector('.nav');
  if (!nav) return;

  window.addEventListener(
    'scroll',
    () => {
      nav.classList.toggle('nav--scrolled', window.scrollY > 20);
    },
    { passive: true }
  );

  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav__link').forEach((link) => {
    const href = link.getAttribute('href') || '';
    if (
      href.includes(currentPath) ||
      (currentPath === '' && href === 'index.html')
    ) {
      link.classList.add('nav__link--active');
    }
  });

  const hamburger = document.querySelector('.nav__hamburger');
  const mobileNav = document.querySelector('.nav__mobile');
  if (hamburger && mobileNav) {
    hamburger.addEventListener('click', () => {
      const open = !mobileNav.classList.contains('open');
      hamburger.classList.toggle('open', open);
      mobileNav.classList.toggle('open', open);
      hamburger.setAttribute('aria-expanded', String(open));
    });
  }
}

function initMatrix(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const chars =
    'アイウエオカキクケコサシスセソタチツテト0123456789ABCDEF<>{}[]|/\\;:';
  let reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function resize() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }

  resize();
  window.addEventListener('resize', resize, { passive: true });

  if (reduceMotion) {
    ctx.fillStyle = 'rgba(8, 11, 16, 0.9)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }

  const fontSize = 14;
  let cols = Math.floor(canvas.width / fontSize);
  let drops = Array(cols).fill(1);

  function draw() {
    ctx.fillStyle = 'rgba(8, 11, 16, 0.06)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(0, 255, 136, 0.55)';
    ctx.font = fontSize + 'px JetBrains Mono, monospace';

    cols = Math.floor(canvas.width / fontSize);
    if (drops.length !== cols) drops = Array(cols).fill(1);

    for (let i = 0; i < cols; i++) {
      const char = chars[Math.floor(Math.random() * chars.length)];
      ctx.fillText(char, i * fontSize, drops[i] * fontSize);
      if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
        drops[i] = 0;
      }
      drops[i]++;
    }
  }

  setInterval(draw, 55);
}

function initTyping(elementId, texts, speed = 80) {
  const el = document.getElementById(elementId);
  if (!el || !texts?.length) return;

  let textIdx = 0;
  let charIdx = 0;
  let deleting = false;

  function type() {
    const current = texts[textIdx];
    if (deleting) {
      el.textContent = current.substring(0, charIdx - 1);
      charIdx--;
    } else {
      el.textContent = current.substring(0, charIdx + 1);
      charIdx++;
    }

    let delay = deleting ? speed / 2 : speed;

    if (!deleting && charIdx === current.length) {
      delay = 2000;
      deleting = true;
    } else if (deleting && charIdx === 0) {
      deleting = false;
      textIdx = (textIdx + 1) % texts.length;
      delay = 400;
    }

    setTimeout(type, delay);
  }
  type();
}

function initSkillBars() {
  const bars = document.querySelectorAll('.skill-bar__fill');
  if (!bars.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animated');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.3 }
  );

  bars.forEach((bar) => observer.observe(bar));
}

const Toast = {
  container: null,

  init() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    }
  },

  show(message, type = 'info', duration = 3500) {
    this.init();
    const icons = { success: '✓', error: '✕', info: 'i', warning: '!' };
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `
      <span class="toast__icon">${icons[type] || 'i'}</span>
      <span class="toast__msg">${message}</span>
    `;
    this.container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('out');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  success: (msg, dur) => Toast.show(msg, 'success', dur),
  error: (msg, dur) => Toast.show(msg, 'error', dur),
  info: (msg, dur) => Toast.show(msg, 'info', dur),
  warning: (msg, dur) => Toast.show(msg, 'warning', dur),
};

const Modal = {
  show(title, body, actions) {
    let overlay = document.getElementById('modal-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'modal-overlay';
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `<div class="modal"><h3 class="modal__title"></h3><p class="modal__body"></p><div class="modal__actions"></div></div>`;
      document.body.appendChild(overlay);
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) Modal.hide();
      });
    }

    overlay.querySelector('.modal__title').textContent = title;
    overlay.querySelector('.modal__body').textContent = body;
    const actionsEl = overlay.querySelector('.modal__actions');
    actionsEl.innerHTML = '';
    (actions || []).forEach((a) => {
      const btn = document.createElement('button');
      btn.className = `btn ${a.class || ''}`;
      btn.textContent = a.label;
      btn.addEventListener('click', () => {
        Modal.hide();
        a.onClick();
      });
      actionsEl.appendChild(btn);
    });

    overlay.classList.add('open');
  },
  hide() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.classList.remove('open');
  },
};

function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr || '';
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

const TAG_COLORS = {
  web: 'cyan',
  pwn: 'red',
  crypto: 'cyan',
  reverse: 'orange',
  forensics: 'yellow',
  osint: 'cyan',
  'binary-exploitation': 'red',
  network: 'cyan',
  ctf: 'green',
  htb: 'green',
  thm: 'green',
  pico: 'cyan',
  tools: 'orange',
  'red-team': 'red',
  'blue-team': 'cyan',
  malware: 'red',
  opsec: 'orange',
  linux: 'yellow',
  windows: 'cyan',
  nextjs: 'cyan',
  rce: 'red',
  cve: 'orange',
  research: 'green',
  default: 'gray',
};

function tagColor(tag) {
  return TAG_COLORS[String(tag).toLowerCase()] || TAG_COLORS.default;
}

function badgeHtml(tag) {
  return `<span class="badge badge--${tagColor(tag)}">${escapeHtmlShared(tag)}</span>`;
}

function escapeHtmlShared(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str || ''));
  return div.innerHTML;
}

function animateCounter(el, target, duration = 1000) {
  const end = Math.max(0, Number(target) || 0);
  let start = 0;
  const step = end / (duration / 16) || end;
  const timer = setInterval(() => {
    start += step;
    if (start >= end) {
      el.textContent = end;
      clearInterval(timer);
      return;
    }
    el.textContent = Math.floor(start);
  }, 16);
}

document.addEventListener('DOMContentLoaded', () => {
  const isAdmin = /\/admin(\/|$)/.test(window.location.pathname);
  PostsDB.ready(isAdmin).then(() => {
    document.dispatchEvent(
      new CustomEvent('postsdb:ready', { detail: { mode: PostsDB.mode() } })
    );
  });
  initNav();
  initSkillBars();
});
