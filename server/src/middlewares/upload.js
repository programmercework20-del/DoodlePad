import multer from "multer";
import path from "path";

const fileFilter = (req, file, cb) => {
  console.log("📥 Incoming File:", file.originalname, "Mime:", file.mimetype);
  
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = [
    ".jpg", ".jpeg", ".png", ".webp",
    ".mp4", ".mp3", ".wav",
  ".m4a", ".aac", ".ogg" ,
   // ✅ Khali extension allow karein (kuch blobs bina extension ke aate hain)
  ];

  // Agar extension match ho ya MimeType image/video ho
  if (
    allowedExtensions.includes(ext) || 
    file.mimetype.startsWith("image/") || 
    file.mimetype.startsWith("video/") ||
    file.mimetype === "application/octet-stream" // ✅ Doodle data blobs ke liye
  ) {
    cb(null, true);
  } else {
    console.error("❌ Rejected Extension:", ext, "Mime:", file.mimetype);
    cb(new Error("Invalid file type"), false);
  }
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024
  }
});

export default upload;