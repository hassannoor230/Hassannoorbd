import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { uploadDirectory, isManagedImageId } from '../middleware/upload';

export async function removeUploadedImage(publicId: string) {
  if (!isManagedImageId(publicId)) return;
  try { await unlink(path.join(uploadDirectory, publicId)); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}