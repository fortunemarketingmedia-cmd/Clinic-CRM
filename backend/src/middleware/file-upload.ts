import multer from 'multer';
import { env } from '../config/env.js';
import { allowedFileMimeTypes } from '../services/file-storage.service.js';
import { HttpError } from '../utils/http-error.js';

export const patientFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_BYTES, files: 1, fields: 2 },
  fileFilter: (_req, file, callback) => {
    if (!allowedFileMimeTypes.has(file.mimetype)) return callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
    callback(null, true);
  },
});

const medicineImportExtensions = new Set(['.csv', '.xlsx', '.xls']);

export const medicineImportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 1 },
  fileFilter: (_req, file, callback) => {
    const extension = file.originalname.toLowerCase().match(/\.[a-z0-9]+$/)?.[0];
    if (!extension || !medicineImportExtensions.has(extension)) {
      return callback(new HttpError(400, 'Medicine import accepts CSV, XLSX, or XLS files only'));
    }
    callback(null, true);
  },
});
