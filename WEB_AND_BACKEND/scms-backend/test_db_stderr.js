const admin = require("firebase-admin");
console.error("🚀 Initializing firebase admin...");
try {
  const serviceAccount = require("./serviceAccountKey.json");
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  const db = admin.firestore();
  console.error("✅ Initialized! Fetching one user...");
  db.collection("users").limit(1).get().then(snap => {
    console.error("✅ Users snap size:", snap.size);
    process.exit(0);
  }).catch(err => {
    console.error("❌ Firestore fetch error:", err);
    process.exit(1);
  });
} catch (e) {
  console.error("❌ Firebase Init Error:", e);
  process.exit(1);
}
