import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as c from '../controllers/public';

export const publicRouter = Router();
publicRouter.post('/contact', rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false }), c.submitContact);
publicRouter.get('/projects', c.listProjects);
publicRouter.get('/projects/:slug', c.getProject);
publicRouter.get('/categories', c.listCategories);
publicRouter.get('/profile', c.getProfile);