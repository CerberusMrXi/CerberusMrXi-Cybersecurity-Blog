require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { connectDB } = require('./config/db');
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const postsRoutes = require('./routes/posts');

const app = express();
const PORT = process.env.PORT || 3001;

const defaultOrigins = [
  'http://localhost:3000', 'http://127.0.0.1:3000',
  'http://localhost:5000', 'http://127.0.0.1:5000',
  'http://localhost:5500', 'http://127.0.0.1:5500',
  'http://localhost:8080', 'http://127.0.0.1:8080',
  'http://localhost:8765', 'http://127.0.0.1:8765',
  'https://cerberusmrxi.github.io',
  'https://sudeepawanigarathna.vercel.app'
];

const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : defaultOrigins;

app.use(
  cors({
    origin(origin, callback) {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        allowedOrigins.includes('*') ||
        /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
      ) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  })
);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '2mb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 1000 : 5000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health' || req.path === '/health/',
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many auth attempts, try again later' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/setup', authLimiter);

// ── Routes ────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    name: 'CerberusMrXi Blog API',
    version: '1.0.0',
    docs: '/api/health',
    endpoints: {
      health: 'GET /api/health',
      status: 'GET /api/status (auth)',
      posts: 'GET /api/posts',
      auth: 'POST /api/auth/login',
    },
  });
});

// health.js defines GET /health and GET /status → full paths /api/health, /api/status
app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/posts', postsRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error('[API Error]', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────
async function start() {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`[API] Server running on port ${PORT}`);
    console.log(`[API] Health check → http://localhost:${PORT}/api/health`);
  });
}

start();
