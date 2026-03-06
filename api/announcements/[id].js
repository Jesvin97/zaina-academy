const { getCollection } = require('../../lib/mongodb');
const { requireAdmin } = require('../../lib/auth');
const { ObjectId } = require('mongodb');
module.exports = async function(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const auth = await requireAdmin(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    const id = req.query.id;
    if (!id || !ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid ID' });
    const col = await getCollection('announcements');
    const r = await col.deleteOne({ _id: new ObjectId(id) });
    if (r.deletedCount === 0) return res.status(404).json({ error: 'Not found' });
    return res.status(200).json({ success: true });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Server error' }); }
};
