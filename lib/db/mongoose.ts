import mongoose from 'mongoose';

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongoose: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongoose ?? { conn: null, promise: null };
global.mongoose = cached;

export async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'Missing MONGODB_URI in production environment variables. ' +
        'Please configure your MongoDB Atlas connection string in your deployment settings.'
      );
    }
    // Development local fallback
    console.warn('⚠️ No MONGODB_URI set, falling back to local mongodb://127.0.0.1:27017/tripsplit');
  }

  const connectionUri = uri || 'mongodb://127.0.0.1:27017/tripsplit';

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts: mongoose.ConnectOptions = {
      bufferCommands: false,
      maxPoolSize: 10, // Maintain up to 10 socket connections in serverless pool
      serverSelectionTimeoutMS: 5000, // Timeout fast if unreachable
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    };

    cached.promise = mongoose.connect(connectionUri, opts).then((m) => m);
  }

  try {
    cached.conn = await cached.promise;
  } catch (e: any) {
    cached.promise = null;
    if (e.message?.includes('bad auth')) {
      console.error(
        '❌ MongoDB Atlas Authentication Failed: Please check your username and password in MongoDB Atlas -> Database Access (https://cloud.mongodb.com).'
      );
    }
    throw e;
  }

  return cached.conn;
}
