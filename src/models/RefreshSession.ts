import { Schema, model } from 'mongoose';

const schema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'AdminUser', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  family: { type: String, required: true, index: true },
  expiresAt: { type: Date, required: true },
  revokedAt: Date,
  userAgent: { type: String, maxlength: 300 },
  ip: String,
}, { timestamps: true });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 7 }); // purge a week after expiry

export const RefreshSession = model('RefreshSession', schema);
