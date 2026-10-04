import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as c from '../controllers/auth';
import { requireAuth, requireXhr } from '../middleware/auth';

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false,
  message: { success: false, error: { message: 'Too many attempts, try again later' } } });

export const authRouter = Router();
authRouter.post('/login', loginLimiter, c.login);
authRouter.post('/refresh', requireXhr, c.refresh);
authRouter.post('/logout', requireXhr, c.logout);
authRouter.get('/me', requireAuth, c.me);
authRouter.patch('/change-password', requireAuth, loginLimiter, c.changePassword);
