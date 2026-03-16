const { getCollection } = require('../lib/mongodb');
const { authenticateRequest, getDayNumber } = require('../lib/auth');

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
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    var auth = await authenticateRequest(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    var currentDay = getDayNumber();
    var totalDays = parseInt(process.env.COURSE_TOTAL_DAYS) || 30;

    if (currentDay < 1) {
      return res.status(200).json({
        syllabus: [],
        currentDay: 0,
        courseStartDate: process.env.COURSE_START_DATE
      });
    }

    var maxDay = Math.min(currentDay, totalDays);
    var col = await getCollection('syllabus');
    var data = await col.find({ dayNumber: { $lte: maxDay, $gte: 1 } }).sort({ dayNumber: 1 }).toArray();

    var start = new Date(process.env.COURSE_START_DATE + 'T12:00:00');

    var syllabus = data.map(function(item) {
      var correctDate = getWeekdayDate(start, item.dayNumber);
      return {
        dayNumber: item.dayNumber,
        date: formatDate(correctDate),
        filename: item.filename,
        content: item.content,
        isToday: item.dayNumber === currentDay
      };
    });

    return res.status(200).json({
      syllabus: syllabus,
      currentDay: currentDay,
      totalDays: totalDays,
      courseStartDate: process.env.COURSE_START_DATE
    });

  } catch (e) {
    console.error('Syllabus error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
};