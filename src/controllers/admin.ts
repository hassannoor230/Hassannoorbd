import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Types } from 'mongoose';
import { z } from 'zod';
import { AuditLog } from '../models/AuditLog';
import { Category } from '../models/Category';
import { Project } from '../models/Project';
import { SiteProfile } from '../models/SiteProfile';
import { HttpError } from '../utils/errors';
import { audit } from '../services/audit';
import { removeUploadedImage } from '../services/uploads';
import { imageExtension, isManagedImageId, uploadDirectory } from '../middleware/upload';

const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and hyphens');
const httpUrl = z.string().trim().url().refine((value) => /^https?:\/\//i.test(value), 'Use an http(s) URL');
const optionalHttpUrl = z.union([httpUrl, z.literal('')]).default('');

const projectSchema = z.object({
  title: z.string().trim().min(1).max(120),
  slug,
  summary: z.string().trim().max(300).default(''),
  description: z.string().trim().max(10000).default(''),
  categoryId: z.union([z.string().trim(), z.literal('')]).default(''),
  projectType: z.string().trim().max(100).default(''),
  coverImageUrl: optionalHttpUrl,
  coverImagePublicId: z.string().trim().max(120).default(''),
  liveUrl: httpUrl,
  githubUrl: optionalHttpUrl,
  technologies: z.array(z.string().trim().min(1).max(50)).max(30).default([]),
  featured: z.boolean().default(false),
  status: z.enum(['draft', 'published']).default('draft'),
  order: z.number().int().min(0).default(0),
}).strict();

const categorySchema = z.object({
  name: z.string().trim().min(1).max(80),
  slug,
  description: z.string().trim().max(300).default(''),
  order: z.number().int().min(0).default(0),
  active: z.boolean().default(true),
}).strict();

const profileSchema = z.object({
  name: z.string().trim().max(80).default(''),
  role: z.string().trim().max(120).default(''),
  location: z.string().trim().max(120).default(''),
  availability: z.string().trim().max(80).default(''),
  focus: z.string().trim().max(200).default(''),
  bio: z.string().trim().max(4000).default(''),
  portraitUrl: optionalHttpUrl,
  portraitPublicId: z.string().trim().max(120).default(''),
  portraitAlt: z.string().trim().max(160).default(''),
}).strict();

function objectId(value: string | string[]) {
  if (typeof value !== 'string' || !Types.ObjectId.isValid(value)) throw new HttpError(400, 'Invalid resource id');
  return new Types.ObjectId(value);
}

async function projectValues(body: unknown) {
  const values = projectSchema.parse(body);
  let categoryId: Types.ObjectId | undefined;
  if (values.categoryId) {
    categoryId = objectId(values.categoryId);
    if (!(await Category.exists({ _id: categoryId }))) throw new HttpError(400, 'Selected category does not exist');
  }
  const { categoryId: _categoryId, coverImageUrl, coverImagePublicId, githubUrl, ...project } = values;
  if (coverImagePublicId && (!isManagedImageId(coverImagePublicId) || !coverImageUrl.endsWith(`/uploads/${coverImagePublicId}`))) {
    throw new HttpError(400, 'Uploaded image reference is invalid');
  }
  return {
    ...project,
    category: categoryId ?? null,
    githubUrl,
    coverImage: coverImageUrl ? { url: coverImageUrl, publicId: coverImagePublicId || undefined, alt: values.title } : null,
  };
}

function serializeProject(project: any) {
  return {
    ...project,
    id: String(project._id),
    categoryId: project.category?._id ? String(project.category._id) : '',
  };
}

function serializeCategory(category: any, projectCount = 0) {
  return { ...category, id: String(category._id), projectCount };
}

function serializeProfile(profile: any) {
  return { ...profile, id: String(profile._id) };
}

export async function overview(_req: Request, res: Response) {
  const [projects, published, drafts, categories, recentProjects, recentActivity] = await Promise.all([
    Project.countDocuments(),
    Project.countDocuments({ status: 'published' }),
    Project.countDocuments({ status: 'draft' }),
    Category.countDocuments(),
    Project.find().sort({ updatedAt: -1 }).limit(6).populate('category', 'name slug').lean(),
    AuditLog.find().sort({ createdAt: -1 }).limit(6).populate('actor', 'email').lean(),
  ]);
  res.json({ success: true, data: {
    stats: { projects, published, drafts, categories },
    recentProjects: recentProjects.map(serializeProject),
    recentActivity,
  } });
}

export async function listProjects(_req: Request, res: Response) {
  const items = await Project.find().sort({ updatedAt: -1 }).populate('category', 'name slug').lean();
  res.json({ success: true, data: { items: items.map(serializeProject) } });
}

export async function createProject(req: Request, res: Response) {
  const project = await Project.create(await projectValues(req.body));
  await audit(req.auth?.userId, 'project.created', 'Project', project.id, { title: project.title });
  const item = await Project.findById(project.id).populate('category', 'name slug').lean();
  res.status(201).json({ success: true, data: serializeProject(item) });
}

export async function updateProject(req: Request, res: Response) {
  const id = objectId(req.params.id);
  const previous = await Project.findById(id).select('coverImage.publicId');
  if (!previous) throw new HttpError(404, 'Project not found');
  const item = await Project.findByIdAndUpdate(id, await projectValues(req.body), { new: true, runValidators: true })
    .populate('category', 'name slug').lean();
  if (!item) throw new HttpError(404, 'Project not found');
  await audit(req.auth?.userId, 'project.updated', 'Project', String(id), { title: item.title });
  const previousPublicId = previous.coverImage?.publicId;
  if (previousPublicId && previousPublicId !== item.coverImage?.publicId && !(await Project.exists({ 'coverImage.publicId': previousPublicId }))) {
    await removeUploadedImage(previousPublicId);
  }
  res.json({ success: true, data: serializeProject(item) });
}

export async function deleteProject(req: Request, res: Response) {
  const id = objectId(req.params.id);
  const item = await Project.findByIdAndDelete(id);
  if (!item) throw new HttpError(404, 'Project not found');
  await audit(req.auth?.userId, 'project.deleted', 'Project', String(id), { title: item.title });
  const publicId = item.coverImage?.publicId;
  if (publicId && !(await Project.exists({ 'coverImage.publicId': publicId }))) await removeUploadedImage(publicId);
  res.json({ success: true, data: { id: String(id) } });
}

export async function uploadProjectImage(req: Request, res: Response) {
  const file = req.file;
  if (!file) throw new HttpError(400, 'Choose an image to upload');
  const extension = imageExtension(file.buffer);
  if (!extension) throw new HttpError(415, 'The selected file is not a supported image');
  await mkdir(uploadDirectory, { recursive: true });
  const publicId = `${randomUUID()}.${extension}`;
  await writeFile(path.join(uploadDirectory, publicId), file.buffer, { flag: 'wx' });
  res.status(201).json({ success: true, data: { url: `/uploads/${publicId}`, publicId } });
}

export async function deleteProjectImage(req: Request, res: Response) {
  const publicId = req.params.publicId;
  if (typeof publicId !== 'string' || !isManagedImageId(publicId)) throw new HttpError(400, 'Invalid image id');
  if (await Project.exists({ 'coverImage.publicId': publicId })) throw new HttpError(409, 'This image is still used by a project');
  if (await SiteProfile.exists({ 'portrait.publicId': publicId })) throw new HttpError(409, 'This image is still used as the profile portrait');
  await removeUploadedImage(publicId);
  res.json({ success: true, data: { publicId } });
}

export async function getProfile(_req: Request, res: Response) {
  const profile = await SiteProfile.findOne({ key: 'default' }).lean();
  res.json({ success: true, data: profile ? serializeProfile(profile) : null });
}

export async function updateProfile(req: Request, res: Response) {
  const values = profileSchema.parse(req.body);
  const { portraitUrl, portraitPublicId, portraitAlt, ...rest } = values;
  if (portraitPublicId && (!isManagedImageId(portraitPublicId) || !portraitUrl.endsWith(`/uploads/${portraitPublicId}`))) {
    throw new HttpError(400, 'Uploaded image reference is invalid');
  }
  const previous = await SiteProfile.findOne({ key: 'default' }).select('portrait.publicId');
  const profile = await SiteProfile.findOneAndUpdate({ key: 'default' }, {
    ...rest,
    portrait: portraitUrl ? { url: portraitUrl, publicId: portraitPublicId || undefined, alt: portraitAlt || rest.name } : null,
  }, { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }).lean();
  if (!profile) throw new HttpError(404, 'Profile not found');
  await audit(req.auth?.userId, 'profile.updated', 'Profile', String(profile._id));
  const previousPublicId = previous?.portrait?.publicId;
  if (previousPublicId && previousPublicId !== profile.portrait?.publicId && !(await SiteProfile.exists({ 'portrait.publicId': previousPublicId }))) {
    await removeUploadedImage(previousPublicId);
  }
  res.json({ success: true, data: serializeProfile(profile) });
}

export async function listCategories(_req: Request, res: Response) {
  const [categories, counts] = await Promise.all([
    Category.find().sort({ order: 1, name: 1 }).lean(),
    Project.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
  ]);
  const countByCategory = new Map(counts.map((entry) => [String(entry._id), entry.count]));
  const items = categories.map((category) => serializeCategory(category, countByCategory.get(String(category._id)) ?? 0));
  res.json({ success: true, data: { items } });
}

export async function createCategory(req: Request, res: Response) {
  const category = await Category.create(categorySchema.parse(req.body));
  await audit(req.auth?.userId, 'category.created', 'Category', category.id, { name: category.name });
  res.status(201).json({ success: true, data: serializeCategory(category.toObject()) });
}

export async function updateCategory(req: Request, res: Response) {
  const id = objectId(req.params.id);
  const category = await Category.findByIdAndUpdate(id, categorySchema.parse(req.body), { new: true, runValidators: true });
  if (!category) throw new HttpError(404, 'Category not found');
  await audit(req.auth?.userId, 'category.updated', 'Category', String(id), { name: category.name });
  const projectCount = await Project.countDocuments({ category: id });
  res.json({ success: true, data: serializeCategory(category.toObject(), projectCount) });
}

export async function deleteCategory(req: Request, res: Response) {
  const id = objectId(req.params.id);
  if (await Project.exists({ category: id })) throw new HttpError(409, 'Move or remove this category from its projects before deleting it');
  const category = await Category.findByIdAndDelete(id);
  if (!category) throw new HttpError(404, 'Category not found');
  await audit(req.auth?.userId, 'category.deleted', 'Category', String(id), { name: category.name });
  res.json({ success: true, data: { id: String(id) } });
}