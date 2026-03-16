require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const { fetchAndExtractPdf } = require('../lib/drive');
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

function isTodayWeekend() {
  return isWeekend(new Date());
}

async function sendMorningEmail() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    console.log('Starting morning email job...');

    // Skip weekends entirely
    if (isTodayWeekend()) {
      const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
      console.log('Today is ' + dayName + '. Skipping — no class on weekends.');
      return;
    }

    await client.connect();
    const db = client.db('zaina-academy');

    const dayNumber = getDayNumber();
    const totalDays = parseInt(process.env.COURSE_TOTAL_DAYS) || 30;

    console.log('Today is Day ' + dayNumber + ' (weekdays only)');

    if (dayNumber < 1) {
      console.log('Course has not started yet. Skipping.');
      return;
    }

    if (dayNumber > totalDays) {
      console.log('Course has ended. Skipping.');
      return;
    }

    // Fetch PDF from Google Drive
    console.log('Fetching day' + dayNumber + '.pdf from Google Drive...');
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const pdfData = await fetchAndExtractPdf(folderId, dayNumber);
    console.log('Extracted ' + pdfData.content.length + ' characters');

    // Calculate date
    const startDate = new Date(process.env.COURSE_START_DATE);
    const dayDate = new Date();
    dayDate.setHours(0, 0, 0, 0);

    // Save to MongoDB
    await db.collection('syllabus').updateOne(
      { dayNumber: dayNumber },
      {
        $set: {
          dayNumber: dayNumber,
          date: dayDate.toISOString().split('T')[0],
          filename: pdfData.filename,
          content: pdfData.content,
          syncedAt: new Date(),
        },
      },
      { upsert: true }
    );
    console.log('Saved to MongoDB');

    // Get all student emails
    const students = await db.collection('users').find({ role: 'student' }).toArray();
    const emails = students.map(function(s) { return s.email; });

    if (emails.length === 0) {
      console.log('No students found. Skipping email.');
      return;
    }

    console.log('Sending to ' + emails.length + ' students...');

    const dayDateStr = dayDate.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    const subject = 'Day ' + dayNumber + ' Syllabus — Zaina Academy';
    const title = 'Day ' + dayNumber + ' — ' + dayDateStr;
    const footer = 'Login to your dashboard: ' + (process.env.SITE_URL || '');

    const results = await sendBulkEmail(emails, subject, title, pdfData.content, footer);
    const sent = results.filter(function(r) { return r.success; }).length;
    console.log('Done. Emails sent: ' + sent + '/' + emails.length);

  } catch (error) {
    console.error('Morning email failed:', error.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

sendMorningEmail();
