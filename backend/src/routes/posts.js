const express = require('express');
const Post = require('../models/Post');
const { authRequired } = require('../middleware/auth');
const { isConnected } = require('../config/db');

const router = express.Router();

function dbGuard(req, res, next) {
  if (!isConnected()) {
    return res.status(503).json({ error: 'Database unavailable' });
  }
  next();
}

async function findPost(id) {
  if (id.match(/^[0-9a-fA-F]{24}$/)) {
    return Post.findById(id);
  }
  return Post.findOne({ legacyId: id });
}

// ── Public: published posts ─────────────────────────────────
router.get('/', dbGuard, async (req, res) => {
  const { type, category, search, limit = 100 } = req.query;
  const filter = { status: 'published' };

  if (type) filter.type = type;
  if (category && category !== 'all') filter.category = category;
  if (search) {
    filter.$text = { $search: search };
  }

  const posts = await Post.find(filter).sort({ date: -1 }).limit(Number(limit));
  res.json(posts.map((p) => p.toClient()));
});

// ── Admin: all posts ────────────────────────────────────────
router.get('/all', authRequired, dbGuard, async (req, res) => {
  const posts = await Post.find().sort({ date: -1 });
  res.json(posts.map((p) => p.toClient()));
});

// ── Export backup ─────────────────────────────────────────────
router.get('/export/all', authRequired, dbGuard, async (req, res) => {
  const posts = await Post.find().sort({ date: -1 });
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename=sw-blog-backup.json');
  res.json(posts.map((p) => p.toClient()));
});

// ── Stats ─────────────────────────────────────────────────────
router.get('/stats/summary', dbGuard, async (req, res) => {
  const [total, published, drafts, ctfs, viewsAgg] = await Promise.all([
    Post.countDocuments(),
    Post.countDocuments({ status: 'published' }),
    Post.countDocuments({ status: 'draft' }),
    Post.countDocuments({ type: 'ctf', status: 'published' }),
    Post.aggregate([{ $group: { _id: null, total: { $sum: '$views' } } }]),
  ]);

  res.json({
    total,
    published,
    drafts,
    ctfs,
    totalViews: viewsAgg[0]?.total || 0,
  });
});

// ── Single post ───────────────────────────────────────────────
router.get('/:id', dbGuard, async (req, res) => {
  const post = await findPost(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const isAdmin = req.headers.authorization?.startsWith('Bearer ');
  if (post.status !== 'published' && !isAdmin) {
    return res.status(404).json({ error: 'Post not found' });
  }

  res.json(post.toClient());
});

// ── Create ────────────────────────────────────────────────────
router.post('/', authRequired, dbGuard, async (req, res) => {
  const data = req.body;
  if (!data.title?.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }

  const post = new Post({
    legacyId: data.id || `post-${Date.now()}`,
    title: data.title.trim(),
    excerpt: data.excerpt || '',
    content: data.content || '',
    category: data.category || 'general',
    tags: data.tags || [],
    type: data.type || 'post',
    status: data.status || 'draft',
    featured: data.featured || false,
    date: data.date || new Date().toISOString().split('T')[0],
    readTime: data.readTime || Math.max(1, Math.ceil((data.content || '').split(/\s+/).filter(Boolean).length / 200)),
    emoji: data.emoji || '📄',
    coverImage: data.coverImage || '',
    platform: data.platform || '',
    difficulty: data.difficulty || '',
    points: data.points || 0,
  });

  await post.save();
  res.status(201).json(post.toClient());
});

// ── Update ────────────────────────────────────────────────────
router.put('/:id', authRequired, dbGuard, async (req, res) => {
  const post = await findPost(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const fields = [
    'title', 'excerpt', 'content', 'category', 'tags', 'type', 'status',
    'featured', 'date', 'readTime', 'emoji', 'coverImage', 'platform', 'difficulty', 'points',
  ];

  fields.forEach((f) => {
    if (req.body[f] !== undefined) post[f] = req.body[f];
  });

  await post.save();
  res.json(post.toClient());
});

// ── Delete ────────────────────────────────────────────────────
router.delete('/:id', authRequired, dbGuard, async (req, res) => {
  const post = await findPost(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  await post.deleteOne();
  res.json({ message: 'Post deleted', id: req.params.id });
});

// ── Delete all (danger) ───────────────────────────────────────
router.delete('/', authRequired, dbGuard, async (req, res) => {
  const result = await Post.deleteMany({});
  res.json({ message: 'All posts deleted', count: result.deletedCount });
});

// ── Increment views ───────────────────────────────────────────
router.post('/:id/view', dbGuard, async (req, res) => {
  const post = await findPost(req.params.id);
  if (!post || post.status !== 'published') {
    return res.status(404).json({ error: 'Post not found' });
  }

  post.views += 1;
  await post.save();
  res.json({ views: post.views });
});

// ── Import backup ─────────────────────────────────────────────
router.post('/import/all', authRequired, dbGuard, async (req, res) => {
  const { posts, replace = true } = req.body;

  if (!Array.isArray(posts)) {
    return res.status(400).json({ error: 'posts must be an array' });
  }

  if (replace) {
    await Post.deleteMany({});
  }

  const docs = posts.map((p) => ({
    legacyId: p.id || `post-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: p.title,
    excerpt: p.excerpt || '',
    content: p.content || '',
    category: p.category || 'general',
    tags: p.tags || [],
    type: p.type || 'post',
    status: p.status || 'draft',
    featured: p.featured || false,
    date: p.date || new Date().toISOString().split('T')[0],
    readTime: p.readTime || 5,
    emoji: p.emoji || '📄',
    platform: p.platform || '',
    difficulty: p.difficulty || '',
    points: p.points || 0,
    views: p.views || 0,
  }));

  await Post.insertMany(docs);
  res.json({ message: 'Import successful', count: docs.length });
});

module.exports = router;
