// Idempotent: upserts by slug with $setOnInsert, so re-running never duplicates or overwrites admin edits.
import { connectDb, disconnectDb } from '../config/db';
import { Category } from '../models/Category';
import { Project } from '../models/Project';

const categories = [
  { name: 'E-commerce', slug: 'e-commerce', order: 1 },
  { name: 'Business Websites', slug: 'business-websites', order: 2 },
  { name: 'Beauty & Lifestyle', slug: 'beauty-lifestyle', order: 3 },
  { name: 'Restaurant & Hospitality', slug: 'restaurant-hospitality', order: 4 },
  { name: 'Web Applications', slug: 'web-applications', order: 5 },
];

const neutral = (name: string) => `${name} is a live website built by Hassan Noor. A detailed description will be added once its purpose and features have been verified.`;
const projects = [
  { title: 'Bagswave', slug: 'bagswave', cat: 'e-commerce', liveUrl: 'https://bagswave.vercel.app/', projectType: 'E-commerce',
    summary: 'A luxury handbag shopping experience focused on product presentation, brand aesthetics, and online shopping.' },
  { title: 'GlowTeva', slug: 'glowteva', cat: 'beauty-lifestyle', liveUrl: 'https://glowteva.vercel.app/', projectType: 'Beauty & E-commerce',
    summary: 'An organic and skincare-focused e-commerce experience with premium product presentation and brand-led design.' },
  { title: 'Miti', slug: 'miti', cat: 'business-websites', liveUrl: 'https://miti-nine.vercel.app/', projectType: 'Business Website / Web Application',
    summary: neutral('Miti') },
  { title: 'Maestro Cafe Gujranwala', slug: 'maestro-cafe-gujranwala', cat: 'restaurant-hospitality', liveUrl: 'https://maestro-cafe-gujranwala.vercel.app/', projectType: 'Restaurant & Hospitality',
    summary: 'A restaurant-focused digital experience for presenting hospitality-related information and brand identity.' },
  { title: 'Shiza Salon', slug: 'shiza-salon', cat: 'beauty-lifestyle', liveUrl: 'https://shiza-salon.vercel.app/', projectType: 'Salon & Beauty',
    summary: 'A salon-focused website experience for service discovery and customer engagement.' },
  { title: 'Best Hair', slug: 'best-hair', cat: 'beauty-lifestyle', liveUrl: 'https://best-hair.vercel.app/', projectType: 'Hair & Beauty',
    summary: neutral('Best Hair') },
];

(async () => {
  await connectDb();
  const ids: Record<string, any> = {};
  for (const c of categories) {
    const doc = await Category.findOneAndUpdate({ slug: c.slug }, { $setOnInsert: c }, { upsert: true, new: true });
    ids[c.slug] = doc._id;
  }
  let i = 0;
  for (const { cat, ...p } of projects) {
    i++;
    await Project.findOneAndUpdate({ slug: p.slug },
      { $setOnInsert: { ...p, description: p.summary, category: ids[cat], status: 'published', order: i, featured: i <= 3 } },
      { upsert: true });
  }
  console.log(`Seed complete: ${await Category.countDocuments()} categories, ${await Project.countDocuments()} projects.`);
  await disconnectDb();
})().catch((e) => { console.error(e.message); process.exit(1); });
