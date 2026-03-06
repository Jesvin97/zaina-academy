const { getCollection } = require('../lib/mongodb');
const { authenticateRequest, getDayNumber } = require('../lib/auth');
module.exports = async function(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const auth = await authenticateRequest(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    const currentDay = getDayNumber();
    const totalDays = parseInt(process.env.COURSE_TOTAL_DAYS) || 30;
    if (currentDay < 1) return res.status(200).json({ syllabus: [], currentDay: 0, courseStartDate: process.env.COURSE_START_DATE });
    const maxDay = Math.min(currentDay, totalDays);
    const col = await getCollection('syllabus');
    const syllabus = await col.find({ dayNumber: { $lte: maxDay, $gte: 1 } }).sort({ dayNumber: 1 }).toArray();
    const start = new Date(process.env.COURSE_START_DATE);
    const result = syllabus.map(item => {
      const d = new Date(start); d.setDate(start.getDate() + item.dayNumber - 1);
      return { ...item, date: d.toISOString().split('T')[0], isToday: item.dayNumber === currentDay };
    });
    return res.status(200).json({ syllabus: result, currentDay, totalDays, courseStartDate: process.env.COURSE_START_DATE });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Server error' }); }
};
