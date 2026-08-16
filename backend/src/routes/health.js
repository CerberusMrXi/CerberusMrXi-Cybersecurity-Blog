const express = require('express');
const mongoose = require('mongoose');
const { getConnectionInfo, isConnected } = require('../config/db');
const { authRequired } = require('../middleware/auth');
const Post = require('../models/Post');
const Admin = require('../models/Admin');

const router = express.Router();
const startTime = Date.now();

router.get('/health', async (req, res) => {
  const db = getConnectionInfo();
  let postCount = 0;

  if (isConnected()) {
    try {
      postCount = await Post.countDocuments();
    } catch {
      /* ignore */
    }
  }

  res.json({
    status: isConnected() ? 'ok' : 'degraded',
    service: 'cerberusmrxi-blog-api',
    version: '1.0.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
    mongodb: {
      status: db.status,
      connected: isConnected(),
      host: db.host,
      database: db.name,
      readyState: db.readyState,
      lastConnected: db.lastConnected,
      lastError: db.lastError,
    },
    stats: { posts: postCount },
  });
});

router.get('/status', authRequired, async (req, res) => {
  const db = getConnectionInfo();
  const mem = process.memoryUsage();

  let postCount = 0;
  let publishedCount = 0;
  let draftCount = 0;
  let adminExists = false;

  if (isConnected()) {
    [postCount, publishedCount, draftCount, adminExists] = await Promise.all([
      Post.countDocuments(),
      Post.countDocuments({ status: 'published' }),
      Post.countDocuments({ status: 'draft' }),
      Admin.exists({}),
    ]);
  }

  res.json({
    api: {
      status: 'online',
      environment: process.env.NODE_ENV || 'development',
      port: process.env.PORT || 3001,
      uptime: Math.floor((Date.now() - startTime) / 1000),
      uptimeFormatted: formatUptime(Date.now() - startTime),
      nodeVersion: process.version,
      memory: {
        rss: formatBytes(mem.rss),
        heapUsed: formatBytes(mem.heapUsed),
        heapTotal: formatBytes(mem.heapTotal),
      },
    },
    mongodb: {
      status: db.status,
      connected: isConnected(),
      host: db.host || '—',
      database: db.name || '—',
      readyState: db.readyState,
      readyStateLabel: ['disconnected', 'connected', 'connecting', 'disconnecting'][db.readyState] || 'unknown',
      lastConnected: db.lastConnected,
      lastError: db.lastError,
      connectionAttempts: db.connectionAttempts,
      collections: isConnected() ? await mongoose.connection.db.listCollections().toArray().then((c) => c.map((x) => x.name)) : [],
    },
    database: {
      posts: postCount,
      published: publishedCount,
      drafts: draftCount,
      adminConfigured: !!adminExists,
    },
    cors: {
      origins: (process.env.CORS_ORIGINS || '').split(',').filter(Boolean),
    },
    timestamp: new Date().toISOString(),
  });
});

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

module.exports = router;
