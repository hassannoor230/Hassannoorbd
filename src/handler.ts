import type { Request, Response } from 'express';
import { createApp } from './app';
import { connectDb } from './config/db';

// Vercel serverless entry: every request runs through the same Express app, with the database
// connection opened lazily and reused across warm invocations.
const app = createApp();
let ready: Promise<void> | undefined;

export default async function handler(req: Request, res: Response) {
  if (!ready) ready = connectDb().catch((error) => { ready = undefined; throw error; });
  await ready;
  app(req, res);
}