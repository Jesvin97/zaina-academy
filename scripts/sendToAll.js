require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const { sendBulkEmail } = require('../lib/gmail');

async function sendToAll() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    console.log('Connected to MongoDB Atlas');
    
    var db = client.db('zaina-academy');
    
    // Fetch ALL students from MongoDB Atlas
    var students = await db.collection('users').find({ role: 'student' }).toArray();
    
    console.log('Found', students.length, 'students in MongoDB Atlas:');
    students.forEach(function(s) {
      console.log('  ??', s.name, '<' + s.email + '>');
    });
    
    if (students.length === 0) {
      console.log('No students to email!');
      return;
    }
    
    // Get email addresses
    var emails = students.map(function(s) { return s.email; });
    
    // Send email to ALL students
    console.log('');
    console.log('Sending email to', emails.length, 'students...');
    
    var subject = 'Welcome to Zaina Academy!';
    var title = 'Welcome Message';
    var content = 'Hello!\n\nWelcome to Zaina Academy. Your account has been set up and you can now access your student dashboard.\n\nLogin at: ' + (process.env.SITE_URL || 'https://your-site.vercel.app') + '\n\nWhat you can do:\n- View daily syllabus\n- Read announcements\n- Submit daily reports\n\nHappy learning!';
    
    var results = await sendBulkEmail(emails, subject, title, content);
    
    console.log('');
    console.log('=== RESULTS ===');
    results.forEach(function(r) {
      if (r.success) {
        console.log('  ?', r.email || 'sent');
      } else {
        console.log('  ?', r.email || 'unknown', '-', r.error || 'failed');
      }
    });
    
    var success = results.filter(function(r) { return r.success; }).length;
    var failed = results.filter(function(r) { return !r.success; }).length;
    
    console.log('');
    console.log('Sent:', success, '| Failed:', failed);
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await client.close();
  }
}

sendToAll();
