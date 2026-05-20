import multer from "multer";

// 🚀 1. MEMORY STORAGE (Required for GCS Bucket)
// Local disk pe save karne ki jagah file ko RAM (buffer) mein rakhein
// Taaki controller us buffer ko seedha Google Cloud par bhej sake
const storage = multer.memoryStorage();

// 🛡️ 2. SECURITY FILTER (Only Images Allowed)
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only JPEG, PNG, WEBP, and GIF are allowed!"), false);
  }
};

// ⚙️ 3. MULTER CONFIGURATION
const uploadAd = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024 // 15MB file size limit
  }
});

export default uploadAd;