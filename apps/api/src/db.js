import mongoose from 'mongoose';

export async function connectDb() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB || 'pillsenseai';
  if (!uri) {
    console.warn('[DB] MONGODB_URI not set. Reminders will fail to persist.');
    return;
  }
  try {
    await mongoose.connect(uri, { dbName });
    console.log('[DB] Connected:', dbName);
  } catch (e) {
    console.error('[DB] Connection error:', e.message);
  }
}
