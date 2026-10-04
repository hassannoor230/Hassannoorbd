import type { Request, Response } from 'express';
import { Category } from '../models/Category';
import { Project } from '../models/Project';
import { SiteProfile } from '../models/SiteProfile';
import { HttpError } from '../utils/errors';

export async function listProjects(_req: Request, res: Response) {
  const items = await Project.find({ status: 'published' })
    .sort({ order: 1, _id: 1 })
    .populate('category', 'name slug')
    .lean();
  res.json({ success: true, data: { items } });
}

export async function getProject(req: Request, res: Response) {
  const item = await Project.findOne({ slug: req.params.slug, status: 'published' })
    .populate('category', 'name slug')
    .lean();
  if (!item) throw new HttpError(404, 'Project not found');
  res.json({ success: true, data: item });
}

export async function listCategories(_req: Request, res: Response) {
  const items = await Category.find({ active: true })
    .sort({ order: 1, name: 1 })
    .select('name slug order')
    .lean();
  res.json({ success: true, data: { items } });
}

export async function getProfile(_req: Request, res: Response) {
  const profile = await SiteProfile.findOne({ key: 'default' })
    .select('name role location availability focus bio portrait')
    .lean();
  if (!profile) throw new HttpError(404, 'Profile not configured yet');
  res.json({ success: true, data: profile });
}