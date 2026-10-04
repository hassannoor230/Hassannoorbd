import { env } from './config/env';
import { disconnectDb } from './config/db';
import { createApp } from './app';

// Vercel detects the HTTP server from the listen() call at module load, so it must not wait on the
// database. Requests open the connection lazily through the middleware in app.ts.
const server = createApp().listen(Number(process.env.PORT ?? 4000), () => console.log(`API listening on :${env.PORT}`));

const stop = () => server.close(async () => { await disconnectDb(); process.exit(0); });
process.on('SIGTERM', stop); process.on('SIGINT', stop);