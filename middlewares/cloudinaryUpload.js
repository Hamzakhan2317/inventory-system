import multer from "multer";
import crypto from "crypto";
import path from "path";
import cloudinary from "../config/cloudinary.js";

// Configure multer for memory storage (we'll upload directly to Cloudinary)
const storage = multer.memoryStorage();

// Configuration for file uploads
const UPLOAD_CONFIG = {
  MAX_FILE_SIZE: 20 * 1024 * 1024, // 20MB
  ALLOWED_FILE_TYPES: /\.(jpg|jpeg|png|gif|pdf|doc|docx)$/i,
  ALLOWED_MIME_TYPES: /^(image\/(jpeg|jpg|png|gif)|application\/(pdf|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document))$/i,
};

const upload = multer({
  storage,
  limits: { fileSize: UPLOAD_CONFIG.MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    // Validate file type by extension and mime type
    const extname = UPLOAD_CONFIG.ALLOWED_FILE_TYPES.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = UPLOAD_CONFIG.ALLOWED_MIME_TYPES.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only JPEG, PNG, GIF, PDF, DOC, DOCX files are allowed."
        )
      );
    }
  },
});

// Generate unique filename
const generateFileName = (originalName) => {
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(6).toString("hex");
  const extension = path.extname(originalName).replace('.', '');
  return `${timestamp}-${randomString}`;
};

// Upload single file to Cloudinary
export const uploadToCloudinary = async (file, folder = "inventory-app") => {
  try {
    const fileName = generateFileName(file.originalname);
    const isImage = file.mimetype.startsWith('image/');
    
    // Convert buffer to base64 data URI
    const dataUri = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    
    const uploadOptions = {
      folder: folder,
      public_id: fileName,
      resource_type: isImage ? 'image' : 'raw', // 'image' for images, 'raw' for other files
      ...(isImage && {
        transformation: [
          { quality: 'auto' },
          { fetch_format: 'auto' }
        ]
      })
    };

 

    const result = await cloudinary.uploader.upload(dataUri, uploadOptions);
    console.log("✅ Upload successful:", result.secure_url);

    return {
      url: result.secure_url,
      publicId: result.public_id,
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      width: result.width || null,
      height: result.height || null,
      resourceType: result.resource_type
    };
  } catch (error) {
    console.error("Error uploading to Cloudinary:", error);
    throw new Error("Failed to upload file to Cloudinary: " + error.message);
  }
};

// Delete file from Cloudinary
export const deleteFromCloudinary = async (publicIdOrUrl) => {
  try {
    if (!publicIdOrUrl) return;

    let publicId = publicIdOrUrl;
    
    // Extract public ID from URL if full URL is provided
    if (publicIdOrUrl.includes("cloudinary.com/")) {
      // Extract public ID from Cloudinary URL
      const urlParts = publicIdOrUrl.split('/');
      const uploadIndex = urlParts.findIndex(part => part === 'upload');
      if (uploadIndex !== -1 && urlParts.length > uploadIndex + 2) {
        // Remove version if present and get the path after upload/v{version}/
        let pathAfterUpload = urlParts.slice(uploadIndex + 2).join('/');
        
        // Remove file extension
        publicId = pathAfterUpload.replace(/\.[^/.]+$/, "");
      }
    }

    // Try deleting as image first, then as raw file
    let result;
    try {
      result = await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
    } catch (imageError) {
      // If image deletion fails, try as raw file
      result = await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
    }

    console.log(`File deleted from Cloudinary: ${publicId}`, result);
    return result;
  } catch (error) {
    console.error("Error deleting from Cloudinary:", error);
    // Don't throw error here to prevent blocking other operations
  }
};

// Delete multiple files from Cloudinary
export const deleteMultipleFromCloudinary = async (publicIds) => {
  try {
    if (!Array.isArray(publicIds) || publicIds.length === 0) return;
    
    const deletePromises = publicIds.map((publicId) => deleteFromCloudinary(publicId));
    await Promise.all(deletePromises);
  } catch (error) {
    console.error("Error deleting multiple files from Cloudinary:", error);
  }
};

// Middleware for handling multiple file uploads with Cloudinary
export const uploadFilesToCloudinary = (fields, folder = "inventory-app") => {
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
        // Upload files to Cloudinary
        if (req.files) {
          const uploadPromises = [];
          const uploadedFiles = {};

          // Process each field
          for (const fieldName in req.files) {
            const files = req.files[fieldName];
            uploadedFiles[fieldName] = [];

            for (const file of files) {
              // Use specific folder for each document type or the provided folder
              const fileFolder = `${folder}/${fieldName}`;
              uploadPromises.push(
                uploadToCloudinary(file, fileFolder).then((result) => ({
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
        console.error("Cloudinary upload error:", uploadError);
        
        // Clean up any files that might have been uploaded before the error
        if (req.uploadedFiles) {
          const publicIds = [];
          Object.values(req.uploadedFiles).flat().forEach(file => {
            if (file.publicId) {
              publicIds.push(file.publicId);
            }
          });
          await deleteMultipleFromCloudinary(publicIds);
        }
        
        return res.status(500).json({ error: "Failed to upload files to Cloudinary" });
      }
    });
  };
};

export default {
  uploadToCloudinary,
  deleteFromCloudinary,
  deleteMultipleFromCloudinary,
  uploadFilesToCloudinary,
};
