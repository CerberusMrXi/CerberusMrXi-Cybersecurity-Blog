/* ============================================================
   Backend API Client | api.js
   ============================================================ */

const BlogAPI = {
  _tokenKey: 'sw_api_token',
  _online: null,
  _lastHealth: null,

  baseUrl() {
    return `${window.BLOG_CONFIG.apiBase}/api`;
  },

  getToken() {
    return sessionStorage.getItem(this._tokenKey);
  },

  setToken(token) {
    if (token) sessionStorage.setItem(this._tokenKey, token);
    else sessionStorage.removeItem(this._tokenKey);
  },

  headers(auth = false) {
    const h = { 'Content-Type': 'application/json' };
    if (auth) {
      const token = this.getToken();
      if (token) h.Authorization = `Bearer ${token}`;
    }
    return h;
  },

  async request(path, options = {}) {
    const url = `${this.baseUrl()}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: { ...this.headers(options.auth), ...options.headers },
    });

    let data = null;
    const text = await res.text();
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { error: text || 'Invalid response' };
    }

    if (!res.ok) {
      const err = new Error(data?.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  },

  async checkHealth() {
    try {
      const start = performance.now();
      const data = await this.request('/health');
      const latency = Math.round(performance.now() - start);
      this._online = data.status === 'ok' || data.status === 'degraded' || !!data.service;
      this._lastHealth = { ...data, latency, checkedAt: new Date().toISOString() };
      return this._online;
    } catch {
      this._online = false;
      this._lastHealth = { status: 'offline', latency: null, checkedAt: new Date().toISOString() };
      return false;
    }
  },

  isOnline() {
    return this._online === true;
  },

  getLastHealth() {
    return this._lastHealth;
  },

  async getStatus() {
    return this.request('/status', { auth: true });
  },

  // ── Auth ────────────────────────────────────────────────────
  async setupStatus() {
    return this.request('/auth/setup-status');
  },

  async setup(password) {
    const data = await this.request('/auth/setup', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
    this.setToken(data.token);
    return data;
  },

  async login(password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
    this.setToken(data.token);
    return data;
  },

  async verifyToken() {
    return this.request('/auth/verify', { auth: true });
  },

  async changePassword(password, currentPassword) {
    return this.request('/auth/change-password', {
      method: 'POST',
      auth: true,
      body: JSON.stringify({ password, currentPassword }),
    });
  },

  // ── Posts ───────────────────────────────────────────────────
  async getPublishedPosts(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/posts${qs ? `?${qs}` : ''}`);
  },

  async getAllPosts() {
    return this.request('/posts/all', { auth: true });
  },

  async getPost(id) {
    return this.request(`/posts/${id}`, { auth: !!this.getToken() });
  },

  async savePost(post) {
    if (post.id) {
      try {
        return await this.request(`/posts/${post.id}`, {
          method: 'PUT',
          auth: true,
          body: JSON.stringify(post),
        });
      } catch (err) {
        if (err.status !== 404) throw err;
      }
    }

    return this.request('/posts', {
      method: 'POST',
      auth: true,
      body: JSON.stringify(post),
    });
  },

  async deletePost(id) {
    return this.request(`/posts/${id}`, { method: 'DELETE', auth: true });
  },

  async deleteAllPosts() {
    return this.request('/posts', { method: 'DELETE', auth: true });
  },

  async incrementView(id) {
    return this.request(`/posts/${id}/view`, { method: 'POST' });
  },

  async importPosts(posts, replace = true) {
    return this.request('/posts/import/all', {
      method: 'POST',
      auth: true,
      body: JSON.stringify({ posts, replace }),
    });
  },

  async exportPosts() {
    return this.request('/posts/export/all', { auth: true });
  },

  async getStats() {
    return this.request('/posts/stats/summary');
  },
};
