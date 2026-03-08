require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
async function check() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('zaina-academy');
    const users = await db.collection('users').find({}).toArray();
    
    console.log('');
    console.log('=== ALL USERS IN MONGODB ATLAS ===');
    console.log('Total:', users.length);
    console.log('');
    
    var admins = users.filter(function(u) { return u.role === 'admin'; });
    var students = users.filter(function(u) { return u.role === 'student'; });
    
    console.log('ADMINS (' + admins.length + '):');
    admins.forEach(function(u) {
      console.log('  👑', u.name, '<' + u.email + '>');
    });
    
    console.log('');
    console.log('STUDENTS (' + students.length + '):');
    if (students.length === 0) {
      console.log('  ⚠️  No students found!');
      console.log('  Add students via Admin Panel or addStudent script');
    } else {
      students.forEach(function(u) {
        console.log('  📧', u.name, '<' + u.email + '>');
      });
    }
    
    console.log('');
    console.log('When emails are sent, they go to ALL students listed above.');
    console.log('Add new student via Admin Panel → they automatically get emails!');
    
  } catch (e) { console.error('Error:', e.message); }
  finally { await client.close(); }
}
check();
