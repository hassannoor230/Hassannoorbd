import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../utils/errors';
import { isProd } from '../config/env';

export const notFound = (_req: Request, res: Response) =>
  res.status(404).json({ success: false, error: { message: 'Not found' } });

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError)
    return res.status(400).json({ success: false, error: { message: 'Validation failed', issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) } });
  if (err instanceof HttpError)
    return res.status(err.status).json({ success: false, error: { message: err.message, code: err.code } });
  if (err?.code === 11000)
    return res.status(409).json({ success: false, error: { message: 'Duplicate value', fields: Object.keys(err.keyPattern ?? {}) } });
  if (err?.name === 'ValidationError')
    return res.status(400).json({ success: false, error: { message: err.message } });
  console.error(err);
  res.status(500).json({ success: false, error: { message: isProd ? 'Internal server error' : String(err?.message ?? err) } });
}
