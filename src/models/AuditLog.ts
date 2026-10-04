import { Schema, model } from 'mongoose';

const schema = new Schema({
  actor: { type: Schema.Types.ObjectId, ref: 'AdminUser', index: true },
  action: { type: String, required: true, index: true },
  resourceType: String,
  resourceId: String,
  meta: Schema.Types.Mixed,
}, { timestamps: { createdAt: true, updatedAt: false } });
schema.index({ createdAt: -1 });

export const AuditLog = model('AuditLog', schema);
