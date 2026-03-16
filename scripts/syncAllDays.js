require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const { fetchAndExtractPdf } = require('../lib/drive');

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

async function syncAll() {
  var client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    var db = client.db('zaina-academy');
    var col = db.collection('syllabus');
    var folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    var startDate = new Date(process.env.COURSE_START_DATE + 'T12:00:00');
    var today = new Date();
    today.setHours(12, 0, 0, 0);

    var currentDay = 0;
    var counter = new Date(startDate);
    while (counter <= today) {
      if (counter.getDay() !== 0 && counter.getDay() !== 6) {
        currentDay++;
      }
      counter.setDate(counter.getDate() + 1);
    }

    console.log('Start Date:', process.env.COURSE_START_DATE);
    console.log('Current Day:', currentDay);
    console.log('');

    console.log('=== DATE MAPPING ===');
    for (var d = 1; d <= currentDay; d++) {
      var dt = getWeekdayDate(startDate, d);
      var name = dt.toLocaleDateString('en-US', { weekday: 'long' });
      console.log('  Day', d, '=', formatDate(dt), '(' + name + ')');
    }
    console.log('');

    var synced = 0;
    var failed = 0;

    for (var day = 1; day <= currentDay; day++) {
      var dayDate = getWeekdayDate(startDate, day);
      var dateStr = formatDate(dayDate);
      var dayName = dayDate.toLocaleDateString('en-US', { weekday: 'long' });

      try {
        var pdf = await fetchAndExtractPdf(folderId, day);
        await col.updateOne(
          { dayNumber: day },
          { $set: {
            dayNumber: day,
            date: dateStr,
            filename: pdf.filename,
            content: pdf.content,
            syncedAt: new Date()
          }},
          { upsert: true }
        );
        console.log('Day', day, '→', dateStr, '(' + dayName + ') ✅');
        synced++;
      } catch (e) {
        console.log('Day', day, '→', dateStr, '(' + dayName + ') ❌', e.message);
        failed++;
      }
    }

    console.log('');
    console.log('Synced:', synced, '| Failed:', failed);

    console.log('');
    console.log('=== VERIFIED IN DATABASE ===');
    var saved = await col.find({}).sort({ dayNumber: 1 }).toArray();
    saved.forEach(function(s) {
      var parts = s.date.split('-');
      var dt = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 12, 0, 0);
      var name = dt.toLocaleDateString('en-US', { weekday: 'long' });
      console.log('  Day', s.dayNumber, '→', s.date, '(' + name + ')');
    });

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await client.close();
  }
}

syncAll();