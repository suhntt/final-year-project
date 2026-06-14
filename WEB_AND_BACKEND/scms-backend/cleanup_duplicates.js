const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function cleanup() {
  const usersRef = db.collection("users");
  const snap = await usersRef.get();
  
  console.log(`Checking ${snap.size} user documents...`);
  
  for (const doc of snap.docs) {
    const docId = doc.id;
    const data = doc.data();
    
    // Check if the document ID is purely numeric (e.g. "948729730")
    const isNumericId = /^\d+$/.test(docId);
    if (isNumericId) {
      console.log(`Found duplicate numeric document ID: ${docId}`);
      const numericVal = parseInt(docId);
      
      // Find the corresponding UID document where 'id' field matches the numeric ID
      const realUserSnap = await usersRef.where("id", "==", numericVal).get();
      if (!realUserSnap.empty) {
        const realUserDoc = realUserSnap.docs[0];
        const realUserData = realUserDoc.data();
        console.log(`Matching primary user found: UID=${realUserDoc.id}, Name=${realUserData.name}`);
        
        // Prepare merge data
        const mergedData = {};
        if (data.district) mergedData.district = data.district;
        if (data.districtTopic) mergedData.districtTopic = data.districtTopic;
        if (data.last_lat) mergedData.last_lat = data.last_lat;
        if (data.last_lon) mergedData.last_lon = data.last_lon;
        if (data.location_updated_at) mergedData.location_updated_at = data.location_updated_at;
        if (data.district_updated_at) mergedData.district_updated_at = data.district_updated_at;
        
        // Sum points or take the maximum/additive
        const extraPoints = data.points || 0;
        mergedData.points = (realUserData.points || 0) + extraPoints;
        
        console.log(`Merging into primary UID document:`, mergedData);
        await realUserDoc.ref.update(mergedData);
        
        console.log(`Deleting duplicate numeric document ${docId}...`);
        await doc.ref.delete();
        console.log(`✅ Successfully cleaned up duplicate ${docId}.`);
      } else {
        console.log(`⚠️ No primary user UID document found with 'id' == ${numericVal}. Keeping numeric document.`);
      }
    }
  }
  console.log("Cleanup completed.");
}

cleanup().catch(console.error);
