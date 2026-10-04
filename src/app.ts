import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import rateLimit from 'express-rate-limit';
import { allowedOrigins, env, isProd } from './config/env';
import { api } from './routes';
import { errorHandler, notFound } from './middleware/error';

function isLocalOrigin(origin: string) {
  try {
    const url = new URL(origin);
    return url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  } catch { return false; }
}

export function createApp() {
  const app = express();
  if (isProd) app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({
    origin: (origin, cb) => (!origin || allowedOrigins.includes(origin) || (!isProd && isLocalOrigin(origin)) ? cb(null, true) : cb(new Error('Origin not allowed'))),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    maxAge: 600,
  }));
  app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: true, legacyHeaders: false }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use('/uploads', (_req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  }, express.static(path.resolve(process.cwd(), env.UPLOAD_DIR), { immutable: true, maxAge: '1y' }));
  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/v1', api);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
