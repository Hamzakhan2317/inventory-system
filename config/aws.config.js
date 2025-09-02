import { S3Client } from "@aws-sdk/client-s3";
import "dotenv/config";

// AWS S3 Configuration
export const aws_config = {
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  bucketName: process.env.AWS_S3_BUCKET_NAME,
};

// AWS S3 setup
const s3Config = {
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  // Add configuration to handle redirects automatically
  forcePathStyle: false,
  followRegionRedirects: true,
};
// Create S3 client
export const s3Client = new S3Client(s3Config);

// S3 Configuration constants
export const S3_CONFIG = {
  // File size limits
  MAX_FILE_SIZE: 20 * 1024 * 1024, // 20MB

  // Allowed file types
  ALLOWED_FILE_TYPES: /jpeg|jpg|png|pdf|doc|docx/,

  // S3 ACL settings
  DEFAULT_ACL: "public-read",
};

// Helper function to generate S3 URL
export const generateS3Url = (key) => {
  return `https://${aws_config.bucketName}.s3.${aws_config.region}.amazonaws.com/${key}`;
};

export const extractS3Key = (url) => {
  return url.split("amazonaws.com/")[1];
};
