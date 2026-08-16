const mongoose = require('mongoose');

const postSchema = new mongoose.Schema(
  {
    legacyId: { type: String, unique: true, sparse: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    excerpt: { type: String, default: '', maxlength: 400 },
    content: { type: String, default: '' },
    category: { type: String, default: 'general' },
    tags: [{ type: String, trim: true, lowercase: true }],
    type: { type: String, enum: ['post', 'ctf'], default: 'post' },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    featured: { type: Boolean, default: false },
    date: { type: String, default: () => new Date().toISOString().split('T')[0] },
    readTime: { type: Number, default: 5 },
    emoji: { type: String, default: '📄', maxlength: 4 },
    coverImage: { type: String, default: '' },
    platform: { type: String, default: '' },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard', 'insane', ''], default: '' },
    points: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
  },
  { timestamps: true }
);

postSchema.index({ status: 1, date: -1 });
postSchema.index({ type: 1, status: 1 });
postSchema.index({ title: 'text', excerpt: 'text', tags: 'text' });

postSchema.methods.toClient = function () {
  const obj = this.toObject();
  return {
    id: obj.legacyId || obj._id.toString(),
    _id: obj._id.toString(),
    title: obj.title,
    excerpt: obj.excerpt,
    content: obj.content,
    category: obj.category,
    tags: obj.tags,
    type: obj.type,
    status: obj.status,
    featured: obj.featured,
    date: obj.date,
    readTime: obj.readTime,
    emoji: obj.emoji,
    coverImage: obj.coverImage || '',
    platform: obj.platform,
    difficulty: obj.difficulty,
    points: obj.points,
    views: obj.views,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
};

module.exports = mongoose.model('Post', postSchema);
