const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Copy helper function exactly to test
async function getUserDocRef(userId) {
  if (!userId) return null;
  const uidStr = userId.toString();
  
  // 1. If it's a numeric ID, prioritize querying the 'id' field to find the real UID document
  const numId = parseInt(userId);
  if (!isNaN(numId) && /^\d+$/.test(uidStr)) {
    const qSnap = await db.collection("users").where("id", "==", numId).limit(1).get();
    if (!qSnap.empty) return qSnap.docs[0].ref;

    const qSnapStr = await db.collection("users").where("id", "==", uidStr).limit(1).get();
    if (!qSnapStr.empty) return qSnapStr.docs[0].ref;
  }

  // 2. Try document with exact ID (UID or Numeric)
  const ref = db.collection("users").doc(uidStr);
  const snap = await ref.get();
  if (snap.exists) return ref;

  // 3. Fallback: Query where field 'id' matches numeric or string (if not checked before)
  if (isNaN(numId) || !/^\d+$/.test(uidStr)) {
    const qSnap = await db.collection("users").where("id", "==", numId).limit(1).get();
    if (!qSnap.empty) return qSnap.docs[0].ref;

    const qSnapStr = await db.collection("users").where("id", "==", uidStr).limit(1).get();
    if (!qSnapStr.empty) return qSnapStr.docs[0].ref;
  }
  
  // 4. Default fallback
  return ref;
}

async function verify() {
  const numericId = 948729730;
  const uidStr = "L321r9EUs1g456WtUxSRml8jsc22";
  
  console.log(`Resolving numeric ID: ${numericId}...`);
  const refFromNumeric = await getUserDocRef(numericId);
  console.log(`Resolved path: ${refFromNumeric.path}`);
  
  console.log(`Resolving UID: ${uidStr}...`);
  const refFromUid = await getUserDocRef(uidStr);
  console.log(`Resolved path: ${refFromUid.path}`);
  
  if (refFromNumeric.path === refFromUid.path) {
    console.log("✅ Success! Both Numeric ID and UID resolve to the SAME document!");
  } else {
    console.error("❌ Error! Mismatch in resolved paths!");
  }
  
  process.exit(0);
}

verify().catch(console.error);
