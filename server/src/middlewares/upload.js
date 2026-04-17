import multer from "multer";
import path from "path";

const fileFilter = (req, file, cb) => {
  console.log("FILE:", file.originalname, file.mimetype);
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = [
    ".jpg", ".jpeg", ".png", ".webp",
    ".mp4", ".mp3", ".wav"
  ];
  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
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