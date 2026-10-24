import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs";

// Ensure storage directories exist
const uploadBaseDir = path.resolve("./uploads");
const briefsDir = path.join(uploadBaseDir, "briefs");
const assetsDir = path.join(uploadBaseDir, "assets");

if (!fs.existsSync(uploadBaseDir)) fs.mkdirSync(uploadBaseDir, { recursive: true });
if (!fs.existsSync(briefsDir)) fs.mkdirSync(briefsDir, { recursive: true });
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

// Allowed MIME types and corresponding safe extensions
const ALLOWED_MIME_TYPES = {
  // Documents / Briefs
  "application/pdf": ".pdf",
  "text/plain": ".txt",
  "text/markdown": ".md",

  // Images
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",

  // Video
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/webm": ".webm",

  // Audio
  "audio/mpeg": ".mp3",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "audio/aac": ".aac",
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // If it's a brief upload, send to briefs directory; else assets directory
    const targetDir = req.baseUrl.includes("/briefs") ? briefsDir : assetsDir;
    cb(null, targetDir);
  },
  filename: (req, file, cb) => {
    // Generate safe, unguessable filename using randomBytes
    const safeExt = ALLOWED_MIME_TYPES[file.mimetype] || path.extname(file.originalname).toLowerCase();
    const randomName = crypto.randomBytes(16).toString("hex");
    cb(null, `${Date.now()}-${randomName}${safeExt}`);
  },
});

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME_TYPES[file.mimetype]) {
    const err = new Error(
      `Unsupported file type (${file.mimetype}). Permitted types include PDF, TXT, MP4, MOV, MP3, WAV, JPG, PNG, WEBP.`
    );
    err.statusCode = 415;
    return cb(err, false);
  }
  cb(null, true);
}

const maxFileSizeMB = parseInt(process.env.UPLOAD_MAX_FILE_SIZE_MB || "50", 10);

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: maxFileSizeMB * 1024 * 1024,
    files: 1,
  },
});
