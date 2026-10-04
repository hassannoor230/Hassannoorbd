import { AuditLog } from '../models/AuditLog';

export async function audit(actor: string | undefined, action: string, resourceType?: string, resourceId?: string, meta?: Record<string, unknown>) {
  try { await AuditLog.create({ actor, action, resourceType, resourceId, meta }); }
  catch (e) { console.error('audit log failed', (e as Error).message); }
}
