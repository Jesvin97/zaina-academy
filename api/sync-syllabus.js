const { getCollection } = require('../lib/mongodb');
const { requireAdmin, getDayNumber } = require('../lib/auth');
const { fetchAndExtractPdf } = require('../lib/drive');
const { sendBulkEmail } = require('../lib/gmail');

function getWeekdayDate(startDate, dayNumber) {
  var count = 0;
  var date = new Date(startDate);
  date.setHours(12, 0, 0, 0);

  while (true) {
    var dow = date.getDay();
    if (dow !== 0 && dow !== 6) {
      count++;
      if (count === dayNumber) {
        return date;
      }
    }
    date.setDate(date.getDate() + 1);
  }
}

function formatDate(date) {
  var y = date.getFullYear();
  var m = String(date.getMonth() + 1).padStart(2, '0');
  var d = String(date.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    var auth = await requireAdmin(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    var currentDay = getDayNumber();
    var dayToSync = (req.body && req.body.dayNumber) || currentDay;

    if (dayToSync < 1) return res.status(400).json({ error: 'Course not started' });
    if (dayToSync > currentDay) return res.status(400).json({ error: 'Cannot sync future' });

    var pdf = await fetchAndExtractPdf(process.env.GOOGLE_DRIVE_FOLDER_ID, dayToSync);

    var start = new Date(process.env.COURSE_START_DATE + 'T12:00:00');
    var dayDate = getWeekdayDate(start, dayToSync);
    var dateStr = formatDate(dayDate);

    var col = await getCollection('syllabus');
    await col.updateOne(
      { dayNumber: dayToSync },
      { $set: {
        dayNumber: dayToSync,
        date: dateStr,
        filename: pdf.filename,
        content: pdf.content,
        syncedAt: new Date()
      }},
      { upsert: true }
    );

    var emailsSent = 0;
    try {
      var usersCol = await getCollection('users');
      var students = await usersCol.find({ role: 'student' }).toArray();
      var emails = students.map(function(s) { return s.email; });

      if (emails.length > 0) {
        var prettyDate = dayDate.toLocaleDateString('en-US', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
        var subject = 'Day ' + dayToSync + ' Syllabus — Zaina Academy';
        var title = 'Day ' + dayToSync + ' — ' + prettyDate;
        var footer = 'Login: ' + (process.env.SITE_URL || '');
        var results = await sendBulkEmail(emails, subject, title, pdf.content, footer);
        emailsSent = results.filter(function(r) { return r.success; }).length;
      }
    } catch (emailErr) {
      console.error('Email error:', emailErr.message);
    }

    return res.status(200).json({
      success: true,
      dayNumber: dayToSync,
      filename: pdf.filename,
      emailsSent: emailsSent
    });

  } catch (e) {
    console.error('Sync error:', e);
    return res.status(500).json({ error: e.message });
  }
};