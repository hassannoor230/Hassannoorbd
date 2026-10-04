import type { Request, Response, NextFunction } from 'express';
import { HttpError } from '../utils/errors';
import { verifyAccess } from '../utils/tokens';
import { RefreshSession } from '../models/RefreshSession';

declare global { namespace Express { interface Request { auth?: { userId: string; role: string; sid: string } } } }

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) throw new HttpError(401, 'Authentication required');
  let p;
  try { p = verifyAccess(h.slice(7)); } catch { throw new HttpError(401, 'Invalid or expired token'); }
  // Session must still be live, so logout / password change revokes access immediately.
  const live = await RefreshSession.exists({ _id: p.sid, revokedAt: null, expiresAt: { $gt: new Date() } });
  if (!live) throw new HttpError(401, 'Session ended');
  req.auth = { userId: p.sub, role: p.role, sid: p.sid };
  next();
}

export const requireRole = (...roles: string[]) => (req: Request, _res: Response, next: NextFunction) => {
  if (!req.auth || !roles.includes(req.auth.role)) throw new HttpError(403, 'Forbidden');
  next();
};

// Cookie-based endpoints must carry a custom header, which cross-site forms cannot send.
export function requireXhr(req: Request, _res: Response, next: NextFunction) {
  if (req.headers['x-requested-with'] !== 'fetch') throw new HttpError(403, 'Missing required header');
  next();
}
