import { Router } from 'express';
import * as c from '../controllers/public';

export const publicRouter = Router();
publicRouter.get('/projects', c.listProjects);
publicRouter.get('/projects/:slug', c.getProject);
publicRouter.get('/categories', c.listCategories);
publicRouter.get('/profile', c.getProfile);