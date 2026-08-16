/* ============================================================
   Site & API Configuration | config.js
   Public blog reads assets/data/posts.json (no backend required).
   ============================================================ */

window.BLOG_CONFIG = {
  siteName: 'CerberusMrXi',
  author: 'Sudeepa Wanigarathna',
  handle: 'CerberusMrXi',
  tagline: 'Offensive security research, exploit notes, and CTF writeups.',

  social: {
    github: 'https://github.com/CerberusMrXi',
    twitter: 'https://x.com/SudeepaWanigar1',
    linkedin: 'https://lk.linkedin.com/in/sudeepa-wanigarathna09',
    tryhackme: 'https://tryhackme.com/p/CerberusMrXi',
    email: 'mailto:security@serendibware.com',
  },

  // Optional backend (admin only). Leave unset for static-only public site.
  API_URL: localStorage.getItem('sw_api_url') || 'http://localhost:3001',

  get apiBase() {
    const custom = localStorage.getItem('sw_api_url');
    if (custom) return custom.replace(/\/$/, '');
    if (window.location.hostname.includes('vercel.app')) {
      return window.location.origin;
    }
    return this.API_URL.replace(/\/$/, '');
  },

  /** Resolve path to static data files from any page depth */
  dataUrl(file) {
    const inAdmin = /\/admin(\/|$)/.test(window.location.pathname);
    return `${inAdmin ? '../' : ''}assets/data/${file}`;
  },
};
