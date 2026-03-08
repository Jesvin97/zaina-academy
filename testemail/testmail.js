Set-Content -Path "scripts\testEmail.js" -Value @'
require('dotenv').config({ path: '.env.local' });
const nodemailer = require('nodemailer');

async function testEmail() {
  console.log('=== EMAIL TEST ===');
  console.log('');

  // Step 1: Check credentials
  var gmailUser = process.env.GMAIL_USER;
  var gmailPass = process.env.GMAIL_APP_PASSWORD;

  if (!gmailUser) {
    console.log('ERROR: GMAIL_USER is not set in .env.local');
    return;
  }
  if (!gmailPass) {
    console.log('ERROR: GMAIL_APP_PASSWORD is not set in .env.local');
    return;
  }

  console.log('Gmail User:', gmailUser);
  console.log('App Password:', gmailPass.substring(0, 4) + '****' + gmailPass.substring(gmailPass.length - 4));
  console.log('Password Length:', gmailPass.length, 'characters');
  console.log('');

  // Step 2: Create transporter
  console.log('Creating email transporter...');
  var transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailUser,
      pass: gmailPass
    }
  });

  // Step 3: Verify connection
  console.log('Verifying Gmail connection...');
  try {
    await transporter.verify();
    console.log('Gmail connection: SUCCESS');
  } catch (error) {
    console.log('Gmail connection: FAILED');
    console.log('Error:', error.message);
    console.log('');
    if (error.message.includes('Invalid login')) {
      console.log('POSSIBLE FIXES:');
      console.log('1. Check GMAIL_USER is your correct Gmail address');
      console.log('2. Check GMAIL_APP_PASSWORD is correct (16 characters with spaces)');
      console.log('3. Make sure 2FA is enabled on your Google account');
      console.log('4. Generate a NEW app password at:');
      console.log('   https://myaccount.google.com/apppasswords');
    }
    return;
  }

  // Step 4: Get student emails from database
  console.log('');
  console.log('Checking student emails in database...');
  var { MongoClient } = require('mongodb');
  var client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();
    var db = client.db('zaina-academy');
    var users = await db.collection('users').find({ role: 'student' }).toArray();

    console.log('Found', users.length, 'student(s):');
    users.forEach(function(u) {
      console.log('  -', u.name, '<' + u.email + '>');
    });

    if (users.length === 0) {
      console.log('ERROR: No students in database!');
      console.log('Add a student first using the admin panel');
      return;
    }

    // Step 5: Send test email to first student
    var testStudent = users[0];
    console.log('');
    console.log('Sending test email to:', testStudent.email);

    var htmlContent = '<html><body style="background:#080c14;color:#e8e0d0;font-family:sans-serif;padding:40px">' +
      '<div style="max-width:600px;margin:0 auto">' +
      '<h1 style="color:#d4af5f;text-align:center">✦ Zaina Academy</h1>' +
      '<h2 style="color:#d4af5f">Test Email</h2>' +
      '<div style="background:#0d1220;border:1px solid rgba(212,175,95,0.12);border-radius:12px;padding:24px">' +
      '<p>Hello ' + testStudent.name + '!</p>' +
      '<p>This is a test email from Zaina Academy.</p>' +
      '<p>If you received this, email sending is working correctly!</p>' +
      '<p>Time sent: ' + new Date().toLocaleString() + '</p>' +
      '</div>' +
      '<p style="text-align:center;color:#7a7060;margin-top:20px">© 2026 Zaina Academy</p>' +
      '</div></body></html>';

    var result = await transporter.sendMail({
      from: '"Zaina Academy" <' + gmailUser + '>',
      to: testStudent.email,
      subject: '✅ Test Email - Zaina Academy',
      html: htmlContent
    });

    console.log('');
    console.log('EMAIL SENT SUCCESSFULLY!');
    console.log('Message ID:', result.messageId);
    console.log('');
    console.log('Check the inbox of:', testStudent.email);
    console.log('Also check SPAM folder!');

  } catch (error) {
    console.log('');
    console.log('SEND FAILED:', error.message);
    console.log('');

    if (error.message.includes('Invalid login')) {
      console.log('Your Gmail App Password is wrong.');
      console.log('Generate a new one at: https://myaccount.google.com/apppasswords');
    } else if (error.message.includes('self signed')) {
      console.log('SSL certificate issue. Try adding to .env.local:');
      console.log('NODE_TLS_REJECT_UNAUTHORIZED=0');
    }
  } finally {
    await client.close();
  }

  console.log('');
  console.log('=== TEST COMPLETE ===');
}

testEmail();
'@