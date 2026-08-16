const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema(
  {
    username: { type: String, default: 'admin', unique: true },
    passwordHash: { type: String, required: true },
    lastLogin: { type: Date, default: null },
    loginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Admin', adminSchema);
