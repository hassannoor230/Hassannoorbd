import mongoose from 'mongoose';
import { env } from './env';

let connectionPromise: Promise<void> | undefined;

// Without this a query on a cold instance waits 10s and then reports "buffering timed out",
// which hides the real cause. Failing fast surfaces the actual connection error instead.
mongoose.set('strictQuery', true);
mongoose.set('bufferCommands', false);

export const dbState = () => ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] ?? 'unknown';

export async function connectDb() {
  if (mongoose.connection.readyState === 1) return;
  if (!connectionPromise) {
    connectionPromise = mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
      .then(() => console.log(`MongoDB connected (${mongoose.connection.name})`))
      .catch((error) => {
        connectionPromise = undefined;
        console.error('MongoDB connection failed:', error.message);
        throw error;
      });
  }
  await connectionPromise;
}

export async function disconnectDb() {
  connectionPromise = undefined;
  await mongoose.disconnect();
}