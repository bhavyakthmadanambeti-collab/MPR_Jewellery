import os from 'node:os';
import multer from 'multer';
import { env } from '../config/env.js';
import { IMAGE_MIME, VIDEO_MIME } from '../services/storage.service.js';
import { badRequest } from '../utils/http.js';

/** Images are kept in memory (they're re-encoded by sharp); videos stream to a temp file */
export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxImageMb * 1024 * 1024, files: 30 },
  fileFilter: (_req, file, cb) => {
    if (IMAGE_MIME.includes(file.mimetype)) cb(null, true);
    else cb(badRequest('Only JPG, JPEG, PNG and WEBP images are supported.'));
  },
});

export const videoUpload = multer({
  storage: multer.diskStorage({ destination: os.tmpdir() }),
  limits: { fileSize: env.maxVideoMb * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    const m = file.mimetype === 'video/mov' ? 'video/quicktime' : file.mimetype;
    if (VIDEO_MIME.includes(m)) cb(null, true);
    else cb(badRequest('Only MP4, WEBM and MOV videos are supported.'));
  },
});

/** Mixed media for collections — images go to disk too, then read into memory */
export const mediaUpload = multer({
  storage: multer.diskStorage({ destination: os.tmpdir() }),
  limits: { fileSize: env.maxVideoMb * 1024 * 1024, files: 40 },
  fileFilter: (_req, file, cb) => {
    const m = file.mimetype === 'video/mov' ? 'video/quicktime' : file.mimetype;
    if (IMAGE_MIME.includes(m) || VIDEO_MIME.includes(m)) cb(null, true);
    else cb(badRequest('Unsupported file type. Use JPG, PNG, WEBP, MP4, WEBM or MOV.'));
  },
});
