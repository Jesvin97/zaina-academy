const { getCollection } = require('../lib/mongodb');
const { authenticateRequest } = require('../lib/auth');
module.exports = async function(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const auth = await authenticateRequest(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    const col = await getCollection('reports');
    const query = auth.user.role !== 'admin' ? { studentId: auth.user.userId } : {};
    const items = await col.find(query).sort({ submittedAt: -1 }).toArray();
    return res.status(200).json({ reports: items, reportEmail: process.env.REPORT_EMAIL });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Server error' }); }
};
