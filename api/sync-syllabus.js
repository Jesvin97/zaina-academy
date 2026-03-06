const { getCollection } = require('../lib/mongodb');
const { requireAdmin, getDayNumber } = require('../lib/auth');
const { fetchAndExtractPdf } = require('../lib/drive');
module.exports = async function(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const auth = await requireAdmin(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    const currentDay = getDayNumber();
    const dayToSync = (req.body && req.body.dayNumber) || currentDay;
    if (dayToSync < 1) return res.status(400).json({ error: 'Course not started' });
    if (dayToSync > currentDay) return res.status(400).json({ error: 'Cannot sync future' });
    const pdf = await fetchAndExtractPdf(process.env.GOOGLE_DRIVE_FOLDER_ID, dayToSync);
    const start = new Date(process.env.COURSE_START_DATE);
    const d = new Date(start); d.setDate(start.getDate() + dayToSync - 1);
    const col = await getCollection('syllabus');
    await col.updateOne({ dayNumber: dayToSync }, { $set: { dayNumber: dayToSync, date: d.toISOString().split('T')[0], filename: pdf.filename, content: pdf.content, syncedAt: new Date() } }, { upsert: true });
    return res.status(200).json({ success: true, dayNumber: dayToSync, filename: pdf.filename });
  } catch (e) { console.error(e); return res.status(500).json({ error: e.message }); }
};
