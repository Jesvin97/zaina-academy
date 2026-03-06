const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI;
let client;
let clientPromise;
if (!uri) { throw new Error('Please add MONGODB_URI to environment variables'); }
client = new MongoClient(uri);
clientPromise = client.connect();
async function getDatabase() {
  const c = await clientPromise;
  return c.db('zaina-academy');
}
async function getCollection(name) {
  const db = await getDatabase();
  return db.collection(name);
}
module.exports = { clientPromise, getDatabase, getCollection };
