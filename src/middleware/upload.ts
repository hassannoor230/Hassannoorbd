import multer, { MulterError } from 'multer';
import type { RequestHandler } from 'express';
import path from 'node:path';
import { env } from '../config/env';
import { HttpError } from '../utils/errors';

export const uploadDirectory = path.resolve(process.cwd(), env.UPLOAD_DIR);
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const parseImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) return callback(new HttpError(415, 'Upload a JPEG, PNG, or WebP image'));
    callback(null, true);
  },
});

export const receiveProjectImage: RequestHandler = (req, res, next) => {
  parseImage.single('file')(req, res, (error) => {
    if (!error) return next();
    if (error instanceof MulterError) {
      const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return next(new HttpError(status, error.code === 'LIMIT_FILE_SIZE' ? 'Image must be 5 MB or smaller' : 'Upload one image at a time'));
    }
    next(error);
  });
};

export function imageExtension(buffer: Buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

export function isManagedImageId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/i.test(value);
}