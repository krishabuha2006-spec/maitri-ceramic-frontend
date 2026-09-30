const multer = require('multer');
const path = require('path');
const { sendError } = require('../utils/response.util');

const storage = multer.memoryStorage();

const allowedExtensions = ['.xlsx', '.xls', '.csv', '.pdf'];
const allowedMimeTypes = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  'text/csv', // .csv
  'application/csv',
  'application/pdf' // .pdf
];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedExtensions.includes(ext) || allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type '${ext}'. Only Excel (.xlsx, .xls), CSV (.csv), and PDF (.pdf) files are supported.`), false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024 // 25 MB limit
  },
  fileFilter
});

/**
 * Express middleware wrapper for multer with clean error handling
 */
const handleFileUpload = (fieldName = 'file') => {
  return (req, res, next) => {
    const uploadSingle = upload.single(fieldName);

    uploadSingle(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return sendError(res, 'File size exceeds the 25MB limit.', 400);
        }
        return sendError(res, `File upload error: ${err.message}`, 400);
      } else if (err) {
        return sendError(res, err.message, 400);
      }

      if (!req.file) {
        return sendError(res, `Please upload a file in field '${fieldName}'.`, 400);
      }

      next();
    });
  };
};

const allowedImageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'];
const allowedImageMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml'
];

const imageFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedImageExtensions.includes(ext) || allowedImageMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid image type '${ext}'. Only JPG, JPEG, PNG, WEBP, GIF, and SVG images are supported.`), false);
  }
};

const imageUpload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10 MB limit for images
  },
  fileFilter: imageFileFilter
});

/**
 * Express middleware wrapper for image uploads (Multer + Cloudinary)
 */
const handleImageUpload = (fieldName = 'image') => {
  return (req, res, next) => {
    const uploadSingle = imageUpload.single(fieldName);

    uploadSingle(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return sendError(res, 'Image file size exceeds the 10MB limit.', 400);
        }
        return sendError(res, `Image upload error: ${err.message}`, 400);
      } else if (err) {
        return sendError(res, err.message, 400);
      }

      if (!req.file) {
        return sendError(res, `Please provide an image file in field '${fieldName}'.`, 400);
      }

      next();
    });
  };
};

module.exports = {
  upload,
  handleFileUpload,
  imageUpload,
  handleImageUpload
};
