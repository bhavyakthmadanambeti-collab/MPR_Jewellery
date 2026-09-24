import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { HttpError } from '../utils/http.js';
import { env } from '../config/env.js';

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: 'The requested resource was not found.' });
}

/** Never leaks stack traces — logs server side, returns friendly messages */
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: env.isProd ? undefined : err.details });
  }
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large. Please choose a smaller file.' : 'Upload failed. Please try again.';
    return res.status(400).json({ error: msg });
  }
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large.' });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid request body.' });
  if (err?.code === '23505') return res.status(409).json({ error: 'A record with the same unique value already exists (e.g. SKU or URL).' });
  if (err?.code === '23503') return res.status(409).json({ error: 'This record is linked to other data and cannot be changed.' });
  console.error('[error]', err);
  res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
}
