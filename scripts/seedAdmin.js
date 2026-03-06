require('dotenv').config({ path: '.env.local' });
const bcrypt = require('bcryptjs');
const { MongoClient } = require('mongodb');
async function seedAdmin() {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('MONGODB_URI is not set. Check your .env.local file.'); process.exit(1); }
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    const db = client.db('zaina-academy');
    const users = db.collection('users');
    const existing = await users.findOne({ role: 'admin' });
    if (existing) { console.log('Admin already exists:', existing.email); return; }
    const hash = await bcrypt.hash('admin123', 12);
    await users.insertOne({ name: 'Admin', email: 'admin@zainaacademy.com', passwordHash: hash, role: 'admin', createdAt: new Date() });
    console.log('Admin created successfully!');
    console.log('Email: admin@zainaacademy.com');
    console.log('Password: admin123');
    console.log('Change the password after first login!');
  } catch (err) { console.error('Error:', err.message); process.exit(1); }
  finally { await client.close(); }
}
seedAdmin();
