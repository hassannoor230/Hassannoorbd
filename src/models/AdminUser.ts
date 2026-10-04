import { Schema, model } from 'mongoose';

const schema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['admin'], default: 'admin' },
  lastLoginAt: Date,
  passwordChangedAt: Date,
}, { timestamps: true });

export const AdminUser = model('AdminUser', schema);
