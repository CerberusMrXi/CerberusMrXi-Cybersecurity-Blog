# CerberusMrXi — Cybersecurity Blog & Research Platform

Personal offensive security blog and research platform for **Sudeepa Wanigarathna** ([@CerberusMrXi](https://github.com/CerberusMrXi)). Built with modern HTML5, CSS3, and JavaScript, featuring a hybrid architecture that seamlessly operates as a fast static site (for GitHub Pages / Vercel) or a dynamic REST API-powered application (with Node.js, Express, and MongoDB Atlas).

---

## 🔥 Features

- **Cybersecurity Research & CTF Writeups**: Rich Markdown rendering with syntax highlighting (Highlight.js), table of contents, difficulty badges, platform tags, and estimated read times.
- **Hybrid Storage Engine (`PostsDB`)**: Automatically detects live backend API or seamlessly falls back to static JSON (`assets/data/posts.json`) or browser `localStorage`.
- **Administrative Portal (`/admin/`)**:
  - Secure JWT authentication with brute-force lockout protection.
  - EasyMDE Markdown editor with auto-save, live preview, and word counter.
  - CRUD management for blog posts and CTF writeups.
  - Live API & MongoDB connection status monitoring panel.
  - Full JSON backup export & import tools.
- **RSS & SEO Optimization**: Automated XML feed (`feed.xml`), sitemap generator (`sitemap.xml`), Open Graph meta tags, Content Security Policy (CSP), and semantic HTML.
- **Cyberpunk / Terminal Aesthetics**: Custom dark theme with matrix code animation, responsive glassmorphism navigation, and interactive skill meters.

---

## 📁 Repository Structure

```text
.
├── index.html              # Homepage with hero, search, & category filters
├── post.html               # Article viewer (Markdown, TOC, share links)
├── ctf.html                # CTF writeups matrix with platform filters
├── about.html              # Security researcher profile & Serendibware timeline
├── feed.xml                # RSS 2.0 Feed
├── sitemap.xml             # XML Sitemap
├── package.json            # NPM scripts & project metadata
├── vercel.json             # Vercel deployment configuration & API rewrites
├── render.yaml             # Render Infrastructure as Code (Blueprint)
├── DEPLOY.md               # Frontend static deployment guide
├── DEPLOY-BACKEND.md       # MongoDB Atlas & Render backend deployment guide
├── assets/
│   ├── data/posts.json     # Static source-of-truth post data
│   ├── css/                # Modern CSS (main.css, blog.css, admin.css)
│   └── js/                 # Client scripts (main.js, api.js, config.js, etc.)
├── admin/                  # Admin portal (login, editor, dashboard, stats)
├── backend/                # Express & Node.js REST API with MongoDB Mongoose
└── scripts/                # Generators for posts.json, RSS feeds, & sitemaps
```

---

## ⚡ Quick Start & Development

### 1. Run Static Frontend Locally
Launch any static web server from the project root directory:

```bash
# Using Node.js serve
npx serve .

# Or using Python 3
python3 -m http.server 8080
```
Visit `http://localhost:8080` in your browser.

### 2. Run Backend API Locally (Optional)

```bash
cd backend
npm install
npm run dev
```

Create a `backend/.env` file with your credentials:
```env
PORT=3001
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/dbname
JWT_SECRET=your-secure-jwt-secret-key
CORS_ORIGINS=http://localhost:8080,http://127.0.0.1:8080,http://localhost:5500
```

Seed initial sample data:
```bash
npm run backend:seed
```

---

## 🛠️ CLI Helper Commands

| Command | Action |
|---------|--------|
| `npm run generate` | Regenerate static `assets/data/posts.json`, `feed.xml`, and `sitemap.xml` |
| `npm run generate:posts` | Compile static sample posts to `assets/data/posts.json` |
| `npm run generate:feed` | Rebuild RSS `feed.xml` and `sitemap.xml` |
| `npm run backend:dev` | Start backend Express API server with nodemon |
| `npm run backend:seed` | Seed MongoDB Atlas database with sample research posts |
| `npm run backend:start` | Run backend Express API server in production mode |

---

## 🌐 Production Deployment

### Static Frontend (GitHub Pages)
1. Commit and push your code to GitHub:
   ```bash
   git add .
   git commit -m "Publish blog updates"
   git push origin main
   ```
2. In GitHub, go to **Settings → Pages**.
3. Select **Source**: `Deploy from a branch` → `main` branch, `/ (root)` folder.
4. Your blog will be live at `https://<username>.github.io`.

### Backend API (Render) & Vercel Proxy
For complete step-by-step guides on setting up MongoDB Atlas, Render Web Service, and Vercel reverse proxy:
- 📖 **[DEPLOY-BACKEND.md](file:///home/cerberusmrxi/Desktop/my%20blog/DEPLOY-BACKEND.md)** — Backend API & Database deployment guide.
- 📖 **[DEPLOY.md](file:///home/cerberusmrxi/Desktop/my%20blog/DEPLOY.md)** — Comprehensive static site deployment guide.

---

## 🛡️ License & Author

- **Author**: [Sudeepa Wanigarathna](https://github.com/CerberusMrXi) (`@CerberusMrXi`) — CEO & Founder, Serendibware
- **License**: [MIT License](LICENSE)
