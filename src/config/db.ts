import mongoose from 'mongoose';
import { env } from './env';

let connectionPromise: Promise<void> | undefined;

export async function connectDb() {
  mongoose.set('strictQuery', true);
  if (mongoose.connection.readyState === 1) return;
  if (!connectionPromise) {
    connectionPromise = mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
      .then(() => undefined)
      .catch((error) => {
        connectionPromise = undefined;
        throw error;
      });
  }
  await connectionPromise;
}

export async function disconnectDb() {
  connectionPromise = undefined;
  await mongoose.disconnect();
}
