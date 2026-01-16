import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  maxFileSizeMB: parseInt(process.env.MAX_FILE_MB || '100', 10),
  notificationsEnabled: process.env.NOTIFICATIONS_ENABLED === 'true',
  storagePath: process.env.STORAGE_PATH || './storage',
  tmpPath: process.env.TMP_PATH || './storage/tmp',

  // Allowed file types
  allowedMimeTypes: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // PPTX
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // XLSX
    'application/zip',
    'application/x-zip-compressed'
  ],

  // Allowed file extensions
  allowedExtensions: ['.pdf', '.docx', '.pptx', '.xlsx', '.zip'],

  // Max file name length
  maxFileNameLength: 120
};
