// Quick test: Check if user names are stored in Firestore
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function test() {
  console.log('Fetching users...');
  const usersSnap = await db.collection('users').limit(5).get();
  usersSnap.forEach(doc => {
    const d = doc.data();
    console.log(`User doc ID: ${doc.id}, id: ${d.id}, name: "${d.name}", phone: ${d.phone}`);
  });

  console.log('\nFetching complaints...');
  const compSnap = await db.collection('complaints').limit(5).get();
  compSnap.forEach(doc => {
    const d = doc.data();
    console.log(`Complaint ID: ${d.id}, user_id: ${d.user_id} (type: ${typeof d.user_id}), category: ${d.category}`);
  });

  process.exit(0);
}

test().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
