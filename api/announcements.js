const { getCollection } = require('../lib/mongodb');
const { authenticateRequest, requireAdmin } = require('../lib/auth');
module.exports = async function(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    if (req.method === 'GET') {
      const auth = await authenticateRequest(req);
      if (auth.error) return res.status(auth.status).json({ error: auth.error });
      const col = await getCollection('announcements');
      const items = await col.find({}).sort({ createdAt: -1 }).toArray();
      return res.status(200).json({ announcements: items });
    }
    if (req.method === 'POST') {
      const auth = await requireAdmin(req);
      if (auth.error) return res.status(auth.status).json({ error: auth.error });
      const { title, body } = req.body;
      if (!title || !body) return res.status(400).json({ error: 'Title and body required' });
      const col = await getCollection('announcements');
      const r = await col.insertOne({ title, body, createdAt: new Date() });
      return res.status(201).json({ success: true, id: r.insertedId });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Server error' }); }
};
