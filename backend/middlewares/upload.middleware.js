const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { MAX_FILE_SIZE } = require('../config/env');

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
};

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

const createStorage = (subFolder) =>
  multer.diskStorage({
    destination: (req, file, cb) => {
      const dest = path.join(__dirname, '../../uploads', subFolder);
      ensureDir(dest);
      cb(null, dest);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const name = `${subFolder}-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
      cb(null, name);
    }
  });

const imageFilter = (req, file, cb) => {
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Chỉ chấp nhận file ảnh: JPG, PNG, WEBP'), false);
  }
};

const uploadLabResult = multer({
  storage: createStorage('lab-results'),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: imageFilter
}).single('result_image');

const uploadNewsImage = multer({
  storage: createStorage('news'),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: imageFilter
}).single('thumbnail');

const uploadAvatar = multer({
  storage: createStorage('avatars'),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: imageFilter
}).single('avatar');

const handleUploadError = (uploadFn) => (req, res, next) => {
  uploadFn(req, res, (err) => {
    if (!err) return next();
    const message = err instanceof multer.MulterError
      ? err.code === 'LIMIT_FILE_SIZE' ? 'File quá lớn. Giới hạn 5MB' : err.message
      : err.message;
    return res.status(400).json({ success: false, message });
  });
};

module.exports = {
  uploadLabResult:  handleUploadError(uploadLabResult),
  uploadNewsImage:  handleUploadError(uploadNewsImage),
  uploadAvatar:     handleUploadError(uploadAvatar)
};