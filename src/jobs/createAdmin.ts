// One-time admin initialisation. Usage: npm run admin:init [-- --reset-password]
import bcrypt from 'bcryptjs';
import { env } from '../config/env';
import { connectDb, disconnectDb } from '../config/db';
import { AdminUser } from '../models/AdminUser';
import { RefreshSession } from '../models/RefreshSession';

(async () => {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in the environment');
  if (env.ADMIN_PASSWORD.length < 12) throw new Error('ADMIN_PASSWORD must be at least 12 characters');
  await connectDb();
  const reset = process.argv.includes('--reset-password');
  const existing = await AdminUser.findOne();
  const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 12);
  if (!existing) {
    await AdminUser.create({ email: env.ADMIN_EMAIL, passwordHash });
    console.log('Admin created.');
  } else if (reset) {
    existing.passwordHash = passwordHash; existing.passwordChangedAt = new Date(); await existing.save();
    await RefreshSession.updateMany({ user: existing.id, revokedAt: null }, { revokedAt: new Date() });
    console.log('Admin password reset; all sessions revoked.');
  } else {
    console.log('An admin already exists. Re-run with --reset-password to rotate credentials.');
  }
  await disconnectDb();
})().catch((e) => { console.error(e.message); process.exit(1); });
