const { getCollection } = require('../lib/mongodb');
const { requireAdmin, getDayNumber } = require('../lib/auth');
module.exports = async function(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const auth = await requireAdmin(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    const currentDay = getDayNumber();
    const totalDays = parseInt(process.env.COURSE_TOTAL_DAYS) || 30;
    const col = await getCollection('syllabus');
    const synced = await col.find({}).toArray();
    const syncedMap = {};
    synced.forEach(s => { syncedMap[s.dayNumber] = s; });
    const start = new Date(process.env.COURSE_START_DATE);
    const status = [];
    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i - 1);
      status.push({ dayNumber: i, date: d.toISOString().split('T')[0], status: i > currentDay ? 'future' : syncedMap[i] ? 'synced' : 'pending', syncedAt: syncedMap[i] ? syncedMap[i].syncedAt : null, filename: 'day' + i + '.pdf' });
    }
    return res.status(200).json({ status, currentDay, totalDays, syncedCount: synced.length });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Server error' }); }
};
