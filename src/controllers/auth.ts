import type { Request, Response, CookieOptions } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { env, isProd } from '../config/env';
import { AdminUser } from '../models/AdminUser';
import { RefreshSession } from '../models/RefreshSession';
import { HttpError } from '../utils/errors';
import { hashToken, newRefreshToken, signAccess } from '../utils/tokens';
import { audit } from '../services/audit';

const COOKIE = 'rt';
const REFRESH_DAYS = 7;
const cookieOpts: CookieOptions = {
  httpOnly: true,
  secure: isProd || env.COOKIE_SAMESITE === 'none',
  sameSite: env.COOKIE_SAMESITE,
  path: '/api/v1/auth',
  maxAge: REFRESH_DAYS * 864e5,
};
const clearOpts: CookieOptions = { ...cookieOpts, maxAge: undefined };
// Valid bcrypt hash used to equalise timing when the email is unknown.
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser', 12);

async function startSession(userId: string, role: string, req: Request, res: Response, family: string = crypto.randomUUID()) {
  const token = newRefreshToken();
  const session = await RefreshSession.create({
    user: userId, tokenHash: hashToken(token), family,
    expiresAt: new Date(Date.now() + REFRESH_DAYS * 864e5),
    userAgent: req.headers['user-agent']?.slice(0, 300), ip: req.ip,
  });
  res.cookie(COOKIE, token, cookieOpts);
  return { accessToken: signAccess({ sub: userId, role, sid: session.id }), session };
}

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1).max(200) });

export async function login(req: Request, res: Response) {
  const { email, password } = loginSchema.parse(req.body);
  const user = await AdminUser.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) {
    await audit(undefined, 'auth.login_failed', 'AdminUser', undefined, { email: email.toLowerCase() });
    throw new HttpError(401, 'Invalid email or password');
  }
  user.lastLoginAt = new Date();
  await user.save();
  const { accessToken } = await startSession(user.id, user.role, req, res);
  await audit(user.id, 'auth.login', 'AdminUser', user.id);
  res.json({ success: true, data: { accessToken, user: { id: user.id, email: user.email, role: user.role } } });
}

export async function refresh(req: Request, res: Response) {
  const token = req.cookies?.[COOKIE];
  if (!token) throw new HttpError(401, 'No refresh session');
  const session = await RefreshSession.findOne({ tokenHash: hashToken(token) });
  if (!session) { res.clearCookie(COOKIE, clearOpts); throw new HttpError(401, 'Invalid refresh session'); }
  if (session.revokedAt) {
    // A rotated token was presented again: assume theft and kill the whole family.
    await RefreshSession.updateMany({ family: session.family, revokedAt: null }, { revokedAt: new Date() });
    await audit(String(session.user), 'auth.refresh_reuse_detected', 'RefreshSession', session.id);
    res.clearCookie(COOKIE, clearOpts);
    throw new HttpError(401, 'Session revoked');
  }
  if (session.expiresAt < new Date()) throw new HttpError(401, 'Session expired');
  const user = await AdminUser.findById(session.user);
  if (!user) throw new HttpError(401, 'Account not found');
  session.revokedAt = new Date();
  await session.save();
  const { accessToken } = await startSession(user.id, user.role, req, res, session.family);
  res.json({ success: true, data: { accessToken, user: { id: user.id, email: user.email, role: user.role } } });
}

export async function logout(req: Request, res: Response) {
  const token = req.cookies?.[COOKIE];
  if (token) {
    const s = await RefreshSession.findOneAndUpdate({ tokenHash: hashToken(token), revokedAt: null }, { revokedAt: new Date() });
    if (s) await audit(String(s.user), 'auth.logout', 'AdminUser', String(s.user));
  }
  res.clearCookie(COOKIE, clearOpts);
  res.json({ success: true, data: null });
}

export async function me(req: Request, res: Response) {
  const user = await AdminUser.findById(req.auth!.userId);
  if (!user) throw new HttpError(401, 'Account not found');
  res.json({ success: true, data: { id: user.id, email: user.email, role: user.role, lastLoginAt: user.lastLoginAt } });
}

const pwSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12, 'Use at least 12 characters').max(200),
});

export async function changePassword(req: Request, res: Response) {
  const { currentPassword, newPassword } = pwSchema.parse(req.body);
  const user = await AdminUser.findById(req.auth!.userId).select('+passwordHash');
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) throw new HttpError(400, 'Current password is incorrect');
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.passwordChangedAt = new Date();
  await user.save();
  await RefreshSession.updateMany({ user: user.id, revokedAt: null }, { revokedAt: new Date() });
  res.clearCookie(COOKIE, clearOpts);
  await audit(user.id, 'auth.password_changed', 'AdminUser', user.id);
  res.json({ success: true, data: { message: 'Password changed. Please sign in again.' } });
}
