const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const { authRequired } = require('../middleware/auth');
const { isConnected } = require('../config/db');

const router = express.Router();

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const TOKEN_EXPIRY = '2h';
const JWT_ISSUER = 'cerberusmrxi-blog-api';
const JWT_AUDIENCE = 'cerberusmrxi-admin';

function signToken(admin) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes('change-this')) {
    throw new Error('JWT_SECRET is not configured');
  }

  return jwt.sign(
    {
      sub: admin._id.toString(),
      username: admin.username,
      handle: 'CerberusMrXi',
      author: 'Sudeepa Wanigarathna',
      role: 'admin',
    },
    process.env.JWT_SECRET,
    {
      expiresIn: TOKEN_EXPIRY,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithm: 'HS256',
    }
  );
}

router.get('/setup-status', async (req, res) => {
  if (!isConnected()) {
    return res.status(503).json({ error: 'Database unavailable', needsSetup: true });
  }
  const exists = await Admin.exists({});
  res.json({ needsSetup: !exists, apiOnline: true });
});

router.post('/setup', async (req, res) => {
  if (!isConnected()) {
    return res.status(503).json({ error: 'Database unavailable' });
  }

  const exists = await Admin.exists({});
  if (exists) {
    return res.status(400).json({ error: 'Admin already configured' });
  }

  const { password } = req.body;
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await Admin.create({ passwordHash });

  const admin = await Admin.findOne();
  const token = signToken(admin);

  res.status(201).json({
    message: 'Admin account created',
    token,
    expiresIn: TOKEN_EXPIRY,
  });
});

router.post('/login', async (req, res) => {
  if (!isConnected()) {
    return res.status(503).json({ error: 'Database unavailable' });
  }

  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  const admin = await Admin.findOne();
  if (!admin) {
    return res.status(400).json({ error: 'Admin not configured. Run setup first.', needsSetup: true });
  }

  if (admin.lockedUntil && admin.lockedUntil > new Date()) {
    const remaining = Math.ceil((admin.lockedUntil - new Date()) / 1000);
    return res.status(429).json({
      error: 'Account locked due to too many failed attempts',
      lockedUntil: admin.lockedUntil,
      retryAfter: remaining,
    });
  }

  const valid = await bcrypt.compare(password, admin.passwordHash);

  if (!valid) {
    admin.loginAttempts += 1;
    if (admin.loginAttempts >= MAX_ATTEMPTS) {
      admin.lockedUntil = new Date(Date.now() + LOCKOUT_MS);
      admin.loginAttempts = 0;
    }
    await admin.save();

    const remaining = MAX_ATTEMPTS - admin.loginAttempts;
    return res.status(401).json({
      error: 'Invalid password',
      attemptsRemaining: admin.lockedUntil ? 0 : remaining,
      locked: !!admin.lockedUntil,
    });
  }

  admin.loginAttempts = 0;
  admin.lockedUntil = null;
  admin.lastLogin = new Date();
  await admin.save();

  const token = signToken(admin);
  res.json({ token, expiresIn: TOKEN_EXPIRY });
});

router.get('/verify', authRequired, (req, res) => {
  res.json({ valid: true, admin: { username: req.admin.username } });
});

router.post('/change-password', authRequired, async (req, res) => {
  const { password, currentPassword } = req.body;

  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  const admin = await Admin.findById(req.admin.sub);
  if (!admin) {
    return res.status(404).json({ error: 'Admin not found' });
  }

  if (currentPassword) {
    const valid = await bcrypt.compare(currentPassword, admin.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
  }

  admin.passwordHash = await bcrypt.hash(password, 12);
  await admin.save();

  res.json({ message: 'Password updated successfully' });
});

module.exports = router;
