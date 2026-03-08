const { getCollection } = require('../lib/mongodb');
const { requireAdmin, getDayNumber } = require('../lib/auth');
const { fetchAndExtractPdf } = require('../lib/drive');
const { sendBulkEmail } = require('../lib/gmail');

module.exports = async function(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Verify admin
    var auth = await requireAdmin(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    var currentDay = getDayNumber();
    var dayToSync = (req.body && req.body.dayNumber) || currentDay;

    if (dayToSync < 1) return res.status(400).json({ error: 'Course not started yet' });
    if (dayToSync > currentDay) return res.status(400).json({ error: 'Cannot sync future days' });

    // Step 1: Fetch PDF from Google Drive
    console.log('Fetching day' + dayToSync + '.pdf from Google Drive...');
    var pdf = await fetchAndExtractPdf(process.env.GOOGLE_DRIVE_FOLDER_ID, dayToSync);
    console.log('Extracted', pdf.content.length, 'characters');

    // Step 2: Calculate date for this day
    var start = new Date(process.env.COURSE_START_DATE);
    var dayDate = new Date(start);
    dayDate.setDate(start.getDate() + dayToSync - 1);
    var dateStr = dayDate.toISOString().split('T')[0];

    // Step 3: Save to MongoDB
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
    console.log('Saved to MongoDB');

    // Step 4: Fetch ALL student emails from MongoDB Atlas
    var emailsSent = 0;
    var emailsFailed = 0;
    var emailErrors = [];

    try {
      var usersCol = await getCollection('users');
      var students = await usersCol.find({ role: 'student' }).toArray();
      var emails = students.map(function(s) { return s.email; });

      console.log('Found', emails.length, 'students to email');

      if (emails.length > 0) {
        // Step 5: Send email to ALL students
        var prettyDate = dayDate.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });

        var subject = 'Day ' + dayToSync + ' Syllabus - Zaina Academy';
        var title = 'Day ' + dayToSync + ' — ' + prettyDate;
        var footer = 'Login to your dashboard: ' + (process.env.SITE_URL || '');

        var results = await sendBulkEmail(emails, subject, title, pdf.content, footer);

        emailsSent = results.filter(function(r) { return r.success; }).length;
        emailsFailed = results.filter(function(r) { return !r.success; }).length;

        if (emailsFailed > 0) {
          emailErrors = results
            .filter(function(r) { return !r.success; })
            .map(function(r) { return r.email + ': ' + (r.error || 'unknown'); });
        }

        console.log('Emails sent:', emailsSent, '| Failed:', emailsFailed);
      }
    } catch (emailErr) {
      console.error('Email sending error:', emailErr.message);
      emailErrors.push('Email system error: ' + emailErr.message);
    }

    // Step 6: Return success with email stats
    return res.status(200).json({
      success: true,
      dayNumber: dayToSync,
      filename: pdf.filename,
      contentLength: pdf.content.length,
      syncedAt: new Date().toISOString(),
      emailsSent: emailsSent,
      emailsFailed: emailsFailed,
      emailErrors: emailErrors
    });

  } catch (e) {
    console.error('Sync error:', e);
    return res.status(500).json({ error: e.message || 'Failed to sync' });
  }
};
