const cloudinary = require('cloudinary').v2;
require('dotenv').config();

console.log("☁️ Initializing Cloudinary with config...");
console.log("Cloud Name:", process.env.CLOUDINARY_CLOUD_NAME);
console.log("API Key:", process.env.CLOUDINARY_API_KEY);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// A 1x1 transparent PNG pixel base64 data
const testImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

console.log("📡 Uploading test image to Cloudinary...");
cloudinary.uploader.upload(testImage, { folder: "scms_test" })
  .then(result => {
    console.log("✅ Cloudinary Upload Success!");
    console.log("URL:", result.secure_url);
    process.exit(0);
  })
  .catch(err => {
    console.error("❌ Cloudinary Upload Failed:", err);
    process.exit(1);
  });
