const jwt = require('jsonwebtoken');

const JWT_ISSUER = 'cerberusmrxi-blog-api';
const JWT_AUDIENCE = 'cerberusmrxi-admin';

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes('change-this')) {
    return res.status(500).json({ error: 'Server JWT not configured' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithms: ['HS256'],
    });
    req.admin = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { authRequired };
