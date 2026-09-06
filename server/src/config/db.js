import mongoose from 'mongoose';
import { env } from './env.js';

let memoryServer = null;

/**
 * Connects to MongoDB.
 * If MONGO_URI is not set we spin up an in-memory MongoDB so the project runs
 * with zero external setup. Set MONGO_URI to persist data across restarts.
 */
export async function connectDB(uriOverride) {
  let uri = uriOverride || env.mongoUri;
  let inMemory = false;

  if (!uri) {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create({ instance: { dbName: 'cinebook' } });
    uri = memoryServer.getUri('cinebook');
    inMemory = true;
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });

  return { uri, inMemory };
}

export async function disconnectDB() {
  await mongoose.connection.close();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}
