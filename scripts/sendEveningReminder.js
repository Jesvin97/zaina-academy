require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
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
    if (day < 1 || day > total) { console.log('Course not active.'); return; }
    const students = await db.collection('users').find({ role: 'student' }).toArray();
    const emails = students.map(s => s.email);
    if (!emails.length) { console.log('No students.'); return; }
    const content = 'Please send your Day ' + day + ' report to ' + process.env.REPORT_EMAIL + ' by 7:00 PM today.';
    await sendBulkEmail(emails, 'Report Reminder - Zaina Academy', 'Daily Report Reminder', content);
    console.log('Reminders sent to ' + emails.length + ' students.');
  } catch (e) { console.error(e.message); process.exit(1); }
  finally { await client.close(); }
}
run();
