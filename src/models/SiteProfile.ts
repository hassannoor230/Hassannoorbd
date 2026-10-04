import { Schema, model } from 'mongoose';

const image = new Schema({ url: String, publicId: String, alt: { type: String, default: '' } }, { _id: false });

// Single document holding the editable About content and portrait. 'key' keeps it a singleton.
const schema = new Schema({
  key: { type: String, default: 'default', unique: true, index: true },
  name: { type: String, trim: true, maxlength: 80, default: '' },
  role: { type: String, trim: true, maxlength: 120, default: '' },
  location: { type: String, trim: true, maxlength: 120, default: '' },
  availability: { type: String, trim: true, maxlength: 80, default: '' },
  focus: { type: String, trim: true, maxlength: 200, default: '' },
  bio: { type: String, trim: true, maxlength: 4000, default: '' },
  portrait: image,
}, { timestamps: true });

export const SiteProfile = model('SiteProfile', schema);