const bcrypt = require('bcryptjs');
const { getCollection } = require('../lib/mongodb');
const { generateToken } = require('../lib/auth');
module.exports = async function(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const users = await getCollection('users');
    const user = await users.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = generateToken({ userId: user._id.toString(), email: user.email, name: user.name, role: user.role });
    return res.status(200).json({ token, user: { name: user.name, email: user.email, role: user.role } });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Server error' }); }
};
