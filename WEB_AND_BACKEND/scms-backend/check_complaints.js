const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function main() {
  const complaints = await db.collection("complaints").get();
  console.log("Total complaints:", complaints.size);
  complaints.forEach(doc => {
    console.log(doc.id, "=>", {
      id: doc.data().id,
      category: doc.data().category,
      title: doc.data().title,
      user_id: doc.data().user_id,
      status: doc.data().status,
      upvotes: doc.data().upvotes,
      district: doc.data().district
    });
  });
}
main().catch(console.error);
