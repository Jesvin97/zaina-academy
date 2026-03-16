const { getCollection } = require('../lib/mongodb');
const { requireAdmin, getDayNumber } = require('../lib/auth');

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
    var auth = await requireAdmin(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    var currentDay = getDayNumber();
    var totalDays = parseInt(process.env.COURSE_TOTAL_DAYS) || 30;

    var col = await getCollection('syllabus');
    var synced = await col.find({}).toArray();
    var syncedMap = {};
    synced.forEach(function(s) { syncedMap[s.dayNumber] = s; });

    var start = new Date(process.env.COURSE_START_DATE + 'T12:00:00');

    var status = [];
    for (var day = 1; day <= totalDays; day++) {
      var dayDate = getWeekdayDate(start, day);
      var dateStr = formatDate(dayDate);
      var syncStatus = day > currentDay ? 'future' : (syncedMap[day] ? 'synced' : 'pending');

      status.push({
        dayNumber: day,
        date: dateStr,
        status: syncStatus,
        syncedAt: syncedMap[day] ? syncedMap[day].syncedAt : null,
        filename: 'day' + day + '.pdf'
      });
    }

    return res.status(200).json({
      status: status,
      currentDay: currentDay,
      totalDays: totalDays,
      syncedCount: synced.length
    });

  } catch (e) {
    console.error('Status error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
};