import { env } from './config/env';
import { connectDb, disconnectDb } from './config/db';
import app from './app';

(async () => {
  await connectDb();
  const server = app.listen(env.PORT, () => console.log(`API listening on :${env.PORT}`));
  const stop = () => server.close(async () => { await disconnectDb(); process.exit(0); });
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
})().catch((e) => { console.error('Startup failed:', e.message); process.exit(1); });
