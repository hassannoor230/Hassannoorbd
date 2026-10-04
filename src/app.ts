import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { allowedOrigins, isProd, originAllowed } from './config/env';
import { connectDb, dbState } from './config/db';
import { uploadDirectory, isManagedImageId } from './middleware/upload';
import { api } from './routes';
import { HttpError } from './utils/errors';
import { errorHandler, notFound } from './middleware/error';
import { env } from './config/env';

function isLocalOrigin(origin: string) {
  try {
    const url = new URL(origin);
    return url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  } catch { return false; }
}

function buildApp() {
  const app = express();
  if (isProd) app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({
    origin: (origin, cb) => {
      if (!origin || originAllowed(origin) || (!isProd && isLocalOrigin(origin))) return cb(null, true);
      // Naming the rejected origin makes the fix obvious in the deployment logs.
      console.warn(`CORS blocked origin "${origin}". CLIENT_ORIGIN allows: ${allowedOrigins.join(', ')}`);
      cb(new HttpError(403, `Origin ${origin} is not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    maxAge: 600,
  }));
  app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: true, legacyHeaders: false }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  // Vercel ignores express.static, so uploaded images are streamed from UPLOAD_DIR by hand.
  app.get('/uploads/:file', (req, res, next) => {
    if (!isManagedImageId(req.params.file)) return next();
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.sendFile(req.params.file, { root: uploadDirectory, immutable: true, maxAge: '1y' }, (error) => {
      if (error) next(new HttpError(404, 'Image not found'));
    });
  });
  // Favicon - avoid 404 noise
  app.get('/favicon.ico', (_req, res) => res.status(204).end());
  // Root route - service status
  app.get('/', (_req, res) => res.json({ 
    success: true, 
    data: { 
      service: 'Hassan Noor Portfolio API',
      version: '1.0.0',
      status: 'running'
    } 
  }));
  // Health checks
  app.get('/health', (_req, res) => res.json({ ok: true, db: dbState() }));
  app.get('/api/health', (_req, res) => res.json({ ok: true, db: dbState() }));
  app.get('/api/v1/health', (_req, res) => res.json({ ok: true, db: dbState() }));
  app.use('/api/v1', async (req, _res, next) => {
    if (req.path === '/contact') return next();
    await connectDb();
    next();
  });
  app.use('/api/v1', api);
  app.use(notFound);
  app.use(errorHandler);
  // Warm the connection at cold start so /health reports the real state. Requests still await it.
  void connectDb().catch(() => null);
  return app;
}

let instance: ReturnType<typeof buildApp> | undefined;
export function createApp() {
  instance ??= buildApp();
  return instance;
}

const app = createApp();
export default app;
