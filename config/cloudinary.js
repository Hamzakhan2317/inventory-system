import { v2 as cloudinary } from "cloudinary";
import "dotenv/config";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Test configuration
try {
  cloudinary.api.ping().then(() => {
    console.log("✅ Cloudinary connection successful");
  }).catch((error) => {
    console.error("❌ Cloudinary connection failed:", error.message);
  });
} catch (error) {
  console.error("❌ Cloudinary configuration error:", error.message);
}

export default cloudinary;



