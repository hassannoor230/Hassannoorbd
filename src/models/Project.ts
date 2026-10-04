import { Schema, model } from 'mongoose';

const image = new Schema({ url: String, publicId: String, alt: { type: String, default: '' } }, { _id: false });
const httpUrl = { type: String, validate: { validator: (v: string) => !v || /^https?:\/\//i.test(v), message: 'Must be an http(s) URL' } };

const schema = new Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  slug: { type: String, required: true, unique: true, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ },
  summary: { type: String, maxlength: 300, default: '' },
  description: { type: String, default: '' },
  category: { type: Schema.Types.ObjectId, ref: 'Category', index: true },
  projectType: String,
  coverImage: image,
  gallery: [image],
  technologies: [{ type: String, trim: true }],
  liveUrl: { ...httpUrl, required: true },
  githubUrl: httpUrl,
  featured: { type: Boolean, default: false, index: true },
  status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
  order: { type: Number, default: 0, index: true },
  projectDate: Date,
  caseStudy: {
    problem: String, solution: String, process: String, challenges: String,
    features: [String], results: [String],
  },
  seo: { title: String, description: String },
}, { timestamps: true });
schema.index({ status: 1, order: 1 });

export const Project = model('Project', schema);
