const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists at repo root
const uploadsRoot = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(uploadsRoot)) {
  fs.mkdirSync(uploadsRoot, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsRoot);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext).replace(/[^a-z0-9_-]/gi, '_');
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${name}-${unique}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Allow images and common video formats
  const allowed = /jpeg|jpg|png|gif|webp|mp4|mov|avi|mkv|quicktime/;
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();

  if (allowed.test(ext) || allowed.test(mime)) {
    cb(null, true);
  } else {
    cb(new Error('Only image and video files are allowed'));
  }
};

const upload = multer({ storage, fileFilter });

module.exports = { upload, uploadsRoot };
