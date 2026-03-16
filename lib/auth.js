const jwt = require('jsonwebtoken');

if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not set');

function generateToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function verifyToken(token) {
  try {
    return { decoded: jwt.verify(token, process.env.JWT_SECRET) };
  } catch (e) {
    if (e.name === 'TokenExpiredError') return { error: 'expired' };
    return { error: 'invalid' };
  }
}

function extractToken(req) {
  const h = req.headers.authorization;
  if (h && h.startsWith('Bearer ')) return h.slice(7);
  return null;
}

async function authenticateRequest(req) {
  const token = extractToken(req);
  if (!token) return { error: 'No token provided', status: 401 };

  const { decoded, error } = verifyToken(token);
  if (error === 'expired') return { error: 'Token expired', status: 401 };
  if (error) return { error: 'Invalid token', status: 401 };

  return { user: decoded };
}

async function requireAdmin(req) {
  const result = await authenticateRequest(req);
  if (result.error) return result;

  if (!result.user.role) return { error: 'Role not present in token', status: 403 };
  if (result.user.role !== 'admin') return { error: 'Admin access required', status: 403 };

  return result;
}

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function getDayNumber() {
  const startStr = process.env.COURSE_START_DATE;
  if (!startStr) return 0;

  const [y, m, d] = startStr.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  start.setHours(0, 0, 0, 0);

  if (isNaN(start.getTime())) throw new Error('Invalid COURSE_START_DATE');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (today < start) return 0;

  let count = 0;
  const cursor = new Date(start);

  while (cursor <= today) {
    if (!isWeekend(cursor)) count++;
    cursor.setDate(cursor.getDate() + 1);
  }

  return count;
}

module.exports = {
  generateToken,
  verifyToken,
  extractToken,
  authenticateRequest,
  requireAdmin,
  isWeekend,
  getDayNumber,
};