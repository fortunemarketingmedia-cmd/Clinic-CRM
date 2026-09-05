import multer from 'multer';
import { env } from '../config/env.js';
import { allowedFileMimeTypes } from '../services/file-storage.service.js';

export const patientFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_BYTES, files: 1, fields: 2 },
  fileFilter: (_req, file, callback) => {
    if (!allowedFileMimeTypes.has(file.mimetype)) return callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
    callback(null, true);
  },
});
