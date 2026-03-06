require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const { fetchAndExtractPdf } = require('../lib/drive');
const { sendBulkEmail } = require('../lib/gmail');
function getDayNumber() {
  const s = new Date(process.env.COURSE_START_DATE); s.setHours(0,0,0,0);
  const t = new Date(); t.setHours(0,0,0,0);
  return Math.floor((t - s) / 86400000) + 1;
}
async function run() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('zaina-academy');
    const day = getDayNumber();
    const total = parseInt(process.env.COURSE_TOTAL_DAYS) || 30;
    console.log('Day ' + day);
    if (day < 1 || day > total) { console.log('Course not active.'); return; }
    const pdf = await fetchAndExtractPdf(process.env.GOOGLE_DRIVE_FOLDER_ID, day);
    const start = new Date(process.env.COURSE_START_DATE);
    const d = new Date(start); d.setDate(start.getDate() + day - 1);
    await db.collection('syllabus').updateOne({ dayNumber: day }, { $set: { dayNumber: day, date: d.toISOString().split('T')[0], filename: pdf.filename, content: pdf.content, syncedAt: new Date() } }, { upsert: true });
    const students = await db.collection('users').find({ role: 'student' }).toArray();
    const emails = students.map(s => s.email);
    if (!emails.length) { console.log('No students.'); return; }
    await sendBulkEmail(emails, 'Day ' + day + ' Syllabus - Zaina Academy', 'Day ' + day, pdf.content, process.env.SITE_URL);
    console.log('Done. Sent to ' + emails.length + ' students.');
  } catch (e) { console.error(e.message); process.exit(1); }
  finally { await client.close(); }
}
run();
