const jwt = require('jsonwebtoken');

function generateToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    return null;
  }
}

function extractToken(req) {
  const h = req.headers.authorization;
  if (h && h.startsWith('Bearer ')) return h.substring(7);
  return null;
}

async function authenticateRequest(req) {
  const token = extractToken(req);
  if (!token) return { error: 'No token provided', status: 401 };
  const decoded = verifyToken(token);
  if (!decoded) return { error: 'Invalid token', status: 401 };
  return { user: decoded };
}

async function requireAdmin(req) {
  const result = await authenticateRequest(req);
  if (result.error) return result;
  if (result.user.role !== 'admin') {
    return { error: 'Admin access required', status: 403 };
  }
  return result;
}

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function getDayNumber() {
  const startStr = process.env.COURSE_START_DATE;
  if (!startStr) return 0;

  const start = new Date(startStr);
  start.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (today < start) return 0;

  let count = 0;
  const cursor = new Date(start);

  while (cursor <= today) {
    if (!isWeekend(cursor)) {
      count++;
    }
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