import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export const newRefreshToken = () => crypto.randomBytes(48).toString('base64url');
export const hashToken = (t: string) =>
  crypto.createHmac('sha256', env.JWT_REFRESH_SECRET).update(t).digest('hex');

export type AccessPayload = { sub: string; role: string; sid: string };
export const signAccess = (p: AccessPayload) =>
  jwt.sign(p, env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
export const verifyAccess = (t: string) =>
  jwt.verify(t, env.JWT_ACCESS_SECRET) as jwt.JwtPayload & AccessPayload;
