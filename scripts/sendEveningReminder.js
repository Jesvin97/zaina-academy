require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const { sendBulkEmail } = require('../lib/gmail');

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function getDayNumber() {
  const start = new Date(process.env.COURSE_START_DATE);
  start.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (today < start) return 0;
  let count = 0;
  const current = new Date(start);
  while (current <= today) {
    if (!isWeekend(current)) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

async function sendEveningReminder() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    console.log('Starting evening reminder job...');

    // Skip weekends
    if (isWeekend(new Date())) {
      const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
      console.log('Today is ' + dayName + '. Skipping — no class on weekends.');
      return;
    }

    await client.connect();
    const db = client.db('zaina-academy');

    const dayNumber = getDayNumber();
    const totalDays = parseInt(process.env.COURSE_TOTAL_DAYS) || 30;

    if (dayNumber < 1 || dayNumber > totalDays) {
      console.log('Course not active. Skipping.');
      return;
    }

    console.log('Sending Day ' + dayNumber + ' reminder...');

    const students = await db.collection('users').find({ role: 'student' }).toArray();
    const emails = students.map(function(s) { return s.email; });

    if (emails.length === 0) {
      console.log('No students found. Skipping.');
      return;
    }

    const content = 'Please submit your Day ' + dayNumber + ' report by 7:00 PM today.\n\nUpload it directly from your student dashboard:\n' + (process.env.SITE_URL || '');
    const subject = 'Report Reminder — Day ' + dayNumber + ' — Zaina Academy';

    const results = await sendBulkEmail(emails, subject, 'Daily Report Reminder', content);
    const sent = results.filter(function(r) { return r.success; }).length;
    console.log('Done. Reminders sent: ' + sent + '/' + emails.length);

  } catch (error) {
    console.error('Evening reminder failed:', error.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

sendEveningReminder();
