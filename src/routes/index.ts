import { Router } from 'express';
import { adminRouter } from './admin';
import { authRouter } from './auth';
import { publicRouter } from './public';

export const api = Router();
api.use(publicRouter);
api.use('/auth', authRouter);
api.use('/admin', adminRouter);
