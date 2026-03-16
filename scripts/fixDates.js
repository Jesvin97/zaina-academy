require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function fix() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('zaina-academy');

    // Step 1: Delete ALL old syllabus data
    const deleted = await db.collection('syllabus').deleteMany({});
    console.log('Deleted', deleted.deletedCount, 'old records');

    // Step 2: Show current settings
    console.log('');
    console.log('COURSE_START_DATE:', process.env.COURSE_START_DATE);

    const start = new Date(process.env.COURSE_START_DATE);
    start.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Step 3: Calculate current day (weekdays only)
    let dayNumber = 0;
    const cursor = new Date(start);
    while (cursor <= today) {
      const dow = cursor.getDay();
      if (dow !== 0 && dow !== 6) dayNumber++;
      cursor.setDate(cursor.getDate() + 1);
    }

    console.log('Today:', today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
    console.log('Current Day Number:', dayNumber);
    console.log('');

    // Step 4: Show what each day's date SHOULD be
    console.log('=== CORRECT DATE MAPPING ===');
    let count = 0;
    const walker = new Date(start);

    while (count < Math.min(dayNumber, 30)) {
      const dow = walker.getDay();
      if (dow !== 0 && dow !== 6) {
        count++;
        const dayName = walker.toLocaleDateString('en-US', { weekday: 'short' });
        const dateStr = walker.toISOString().split('T')[0];
        console.log('  Day', count, '=', dateStr, '(' + dayName + ')');
      }
      walker.setDate(walker.getDate() + 1);
    }

    console.log('');
    console.log('Database cleared. Now go to Admin Panel and click "Sync Today\'s PDF"');
    console.log('Or upload day1.pdf to day' + dayNumber + '.pdf in Google Drive and run syncAll.js');

  } catch (e) { console.error(e.message); }
  finally { await client.close(); }
}
fix();