import type { Request, Response } from 'express';
import { Category } from '../models/Category';
import { Project } from '../models/Project';
import { SiteProfile } from '../models/SiteProfile';
import { HttpError } from '../utils/errors';
import { z } from 'zod';
import nodemailer from 'nodemailer';
import { env } from '../config/env';

const contactSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  company: z.string().trim().max(120).optional(),
  projectType: z.string().trim().min(1).max(100),
  budget: z.string().trim().max(200).optional(),
  message: z.string().trim().min(20).max(4000),
  consent: z.literal(true),
  website: z.string().max(0).optional(),
});

export async function submitContact(req: Request, res: Response) {
  const contact = contactSchema.parse(req.body);
  if (contact.website) return res.json({ success: true });
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS || !env.CONTACT_OWNER_EMAIL) {
    throw new HttpError(503, 'Contact email is not configured');
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
  const from = env.SMTP_FROM || env.SMTP_USER;
  const details = [
    `Name: ${contact.name}`,
    `Email: ${contact.email}`,
    `Company: ${contact.company || 'Not provided'}`,
    `Project type: ${contact.projectType}`,
    `Budget: ${contact.budget || 'Not provided'}`,
    '',
    contact.message,
  ].join('\n');

  await Promise.all([
    transporter.sendMail({
      from,
      to: env.CONTACT_OWNER_EMAIL,
      replyTo: contact.email,
      subject: 'New portfolio contact form message',
      text: details,
    }),
    transporter.sendMail({
      from,
      to: contact.email,
      subject: 'Thanks for contacting Hassan Noor',
      text: `Hi ${contact.name},\n\nThanks for contacting us. We will get back to you within 24 hours.\n\nYour message:\n${contact.message}\n\nHassan Noor`,
    }),
  ]);

  res.json({ success: true });
}

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