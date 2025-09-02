import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import multer from "multer";
import crypto from "crypto";
import path from "path";
import { s3Client, aws_config, S3_CONFIG, generateS3Url, extractS3Key } from "../config/aws.config.js";

// Configure multer for memory storage (we'll upload directly to S3)
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: S3_CONFIG.MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    // Use configuration for file type validation
    const extname = S3_CONFIG.ALLOWED_FILE_TYPES.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = S3_CONFIG.ALLOWED_FILE_TYPES.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only JPEG, PNG, PDF, DOC, DOCX files are allowed."
        )
      );
    }
  },
});

// Generate unique filename
const generateFileName = (originalName) => {
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(6).toString("hex");
  const extension = path.extname(originalName);
  return `${timestamp}-${randomString}${extension}`;
};

// Upload single file to S3
export const uploadToS3 = async (file, folder = "documents") => {
  try {
    const fileName = generateFileName(file.originalname);
    const key = `${folder}/${fileName}`;

    const command = new PutObjectCommand({
      Bucket: aws_config.bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: S3_CONFIG.DEFAULT_ACL,
    });

    await s3Client.send(command);

    // Return the public URL using helper function
    const fileUrl = generateS3Url(key);
    return {
      url: fileUrl,
      key: key,
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
    };
  } catch (error) {
    console.error("Error uploading to S3:", error);
    throw new Error("Failed to upload file to S3");
  }
};

// Delete file from S3
export const deleteFromS3 = async (fileKey) => {
  try {
    if (!fileKey) return;

    // Extract key from URL if full URL is provided
    let key = fileKey;
    if (fileKey.includes("amazonaws.com/")) {
      key = fileKey.split("amazonaws.com/")[1];
    }

    const command = new DeleteObjectCommand({
      Bucket: aws_config.bucketName,
      Key: key,
    });

    await s3Client.send(command);
    console.log(`File deleted from S3: ${key}`);
  } catch (error) {
    console.error("Error deleting from S3:", error);
    // Don't throw error here to prevent blocking other operations
  }
};

// Delete multiple files from S3
export const deleteMultipleFromS3 = async (fileKeys) => {
  try {
    const deletePromises = fileKeys.map((key) => deleteFromS3(key));
    await Promise.all(deletePromises);
  } catch (error) {
    console.error("Error deleting multiple files from S3:", error);
  }
};

// Middleware for handling multiple file uploads with S3
export const uploadFilesToS3 = (fields) => {
  return async (req, res, next) => {
    // Use multer to parse files first
    const uploadMiddleware = upload.fields(fields);

    uploadMiddleware(req, res, async (error) => {
      if (error instanceof multer.MulterError) {
        return res
          .status(400)
          .json({ error: "Multer error: " + error.message });
      } else if (error) {
        return res
          .status(500)
          .json({ error: "File upload error: " + error.message });
      }

      try {
        // Upload files to S3
        if (req.files) {
          const uploadPromises = [];
          const uploadedFiles = {};

          // Process each field
          for (const fieldName in req.files) {
            const files = req.files[fieldName];
            uploadedFiles[fieldName] = [];

            for (const file of files) {
              // Use specific folder for each document type
              uploadPromises.push(
                uploadToS3(file).then((result) => ({
                  fieldName,
                  result,
                }))
              );
            }
          }

          // Wait for all uploads to complete
          const results = await Promise.all(uploadPromises);

          // Organize results by field name
          results.forEach(({ fieldName, result }) => {
            uploadedFiles[fieldName].push(result);
          });

          // Add uploaded file info to request
          req.uploadedFiles = uploadedFiles;
        }

        next();
      } catch (uploadError) {
        console.error("S3 upload error:", uploadError);
        return res.status(500).json({ error: "Failed to upload files to S3" });
      }
    });
  };
};

export default {
  uploadToS3,
  deleteFromS3,
  deleteMultipleFromS3,
  uploadFilesToS3,
};
