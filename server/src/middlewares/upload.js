import multer from "multer";
import path from "path";
import fs from "fs";

// 🔥 Absolute path (important in production)
const uploadDir = path.join(process.cwd(), "uploads", "stories");

// 🔥 Ensure folder exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName =
      Date.now() +
      "-" +
      Math.round(Math.random() * 1e9) +
      path.extname(file.originalname);

    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  console.log("FILE:", file.originalname, file.mimetype);

  const ext = path.extname(file.originalname).toLowerCase();

  const allowedExtensions = [
    ".jpg", ".jpeg", ".png", ".webp",
    ".mp4", ".mp3", ".wav"
  ];

  // ✅ ONLY CHECK EXTENSION (ignore mimetype completely)
  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

export default upload;
