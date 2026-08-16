# Backend + MongoDB Deployment Guide

Deploy the blog with **MongoDB Atlas** (free), **Render** (free API), and **Vercel** (free frontend).

## Architecture

```
┌─────────────┐     HTTPS      ┌──────────────┐     MongoDB     ┌─────────────┐
│   Vercel    │ ─────────────► │    Render    │ ──────────────► │ MongoDB     │
│  (Frontend) │   /api proxy   │  (Express)   │    Wire Protocol │ Atlas M0    │
└─────────────┘                └──────────────┘                 └─────────────┘
```

---

## Step 1: MongoDB Atlas (Free M0)

1. Create account at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Create a **Free M0** cluster
3. **Database Access** → Add user with password
4. **Network Access** → Add IP `0.0.0.0/0` (required for Render free tier)
5. **Connect** → Drivers → copy connection string:
   ```
   mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/sw-blog?retryWrites=true&w=majority
   ```

---

## Step 2: Render (Free Backend API)

### Option A: Blueprint (render.yaml)

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → **New** → **Blueprint**
3. Connect repo — Render reads `render.yaml` automatically
4. Set environment variables when prompted:
   - `MONGODB_URI` — your Atlas connection string
   - `CORS_ORIGINS` — your Vercel URL, e.g. `https://your-blog.vercel.app`

### Option B: Manual Web Service

1. **New** → **Web Service** → connect GitHub repo
2. Settings:
   | Field | Value |
   |-------|-------|
   | Root Directory | `backend` |
   | Build Command | `npm install` |
   | Start Command | `npm start` |
   | Plan | **Free** |
   | Health Check Path | `/api/health` |
3. Environment variables:

   | Key | Value |
   |-----|-------|
   | `NODE_ENV` | `production` |
   | `PORT` | `10000` |
   | `MONGODB_URI` | Your Atlas URI |
   | `JWT_SECRET` | Random 32+ char string |
   | `CORS_ORIGINS` | `https://your-blog.vercel.app,https://CerberusMrXi.github.io` |

4. Deploy → note your URL: `https://sw-blog-api.onrender.com`

### Seed sample data (optional)

In Render Shell or locally with `.env` set:
```bash
cd backend
npm install
npm run seed
```

---

## Step 3: Vercel (Free Frontend)

1. Go to [vercel.com](https://vercel.com) → **Add New Project** → import GitHub repo
2. Framework: **Other** (static site, no build command)
3. Edit `vercel.json` — replace `YOUR-RENDER-APP` with your Render URL:
   ```json
   "destination": "https://sw-blog-api.onrender.com/api/:path*"
   ```
4. Deploy → your site: `https://your-blog.vercel.app`

The `/api/*` rewrite proxies API calls to Render so the frontend can use same-origin requests.

---

## Step 4: Connect & Verify

1. Open `https://your-blog.vercel.app/admin/`
2. **First-time setup** — create admin password (stored in MongoDB via API)
3. Go to **Connections** in the sidebar
4. Verify:
   - REST API: **Online**
   - MongoDB: **Connected**
   - Storage Mode: **api**

Or test health directly:
```bash
curl https://sw-blog-api.onrender.com/api/health
```

---

## Local Development

```bash
# Terminal 1 — Backend
cd backend
cp .env.example .env
# Edit .env with your MONGODB_URI
npm install
npm run dev

# Terminal 2 — Frontend (any static server)
npx serve .
# Open http://localhost:3000
```

API runs at `http://localhost:3001`

---

## API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/health` | No | Health + MongoDB status |
| GET | `/api/status` | Yes | Detailed server dashboard |
| POST | `/api/auth/setup` | No | First-run admin setup |
| POST | `/api/auth/login` | No | Login → JWT token |
| GET | `/api/posts` | No | Published posts |
| GET | `/api/posts/all` | Yes | All posts (admin) |
| POST | `/api/posts` | Yes | Create post |
| PUT | `/api/posts/:id` | Yes | Update post |
| DELETE | `/api/posts/:id` | Yes | Delete post |
| POST | `/api/posts/:id/view` | No | Increment view count |
| POST | `/api/posts/import/all` | Yes | Import JSON backup |

---

## Free Tier Limits

| Service | Free Tier |
|---------|-----------|
| **MongoDB Atlas M0** | 512 MB storage, shared cluster |
| **Render Web Service** | 750 hrs/month, spins down after 15 min idle (~30s cold start) |
| **Vercel** | 100 GB bandwidth, unlimited static deployments |

> **Tip:** Render free tier sleeps when idle. First request after sleep takes ~30 seconds. Upgrade to paid ($7/mo) for always-on.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| MongoDB connection failed | Check Atlas IP whitelist (`0.0.0.0/0`), verify URI password |
| CORS error | Add your frontend URL to `CORS_ORIGINS` on Render |
| API offline on Connections panel | Set API URL in Connections → Settings, or start local backend |
| 401 on admin | Re-login; JWT expires after 2 hours |
| Render cold start slow | Normal on free tier — wait 30s and refresh |
