const bcrypt = require('bcryptjs');
const { getCollection } = require('../lib/mongodb');
const { requireAdmin } = require('../lib/auth');
module.exports = async function(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    const auth = await requireAdmin(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    if (req.method === 'GET') {
      const col = await getCollection('users');
      const students = await col.find({ role: 'student' }).project({ passwordHash: 0 }).sort({ createdAt: -1 }).toArray();
      return res.status(200).json({ students });
    }
    if (req.method === 'POST') {
      const { name, email, password } = req.body;
      if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });
      if (password.length < 6) return res.status(400).json({ error: 'Password min 6 chars' });
      const col = await getCollection('users');
      const exists = await col.findOne({ email: email.toLowerCase() });
      if (exists) return res.status(400).json({ error: 'Email already registered' });
      const hash = await bcrypt.hash(password, 12);
      const r = await col.insertOne({ name, email: email.toLowerCase(), passwordHash: hash, role: 'student', createdAt: new Date() });
      return res.status(201).json({ success: true, id: r.insertedId });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Server error' }); }
};
