import { connectDB } from '@/lib/db/mongoose';
import RateLimit from '@/lib/db/models/RateLimit';

interface RateLimitRecord {
  timestamps: number[];
}

// In-memory sliding window store attached to globalThis to survive serverless instance re-use
const globalRateLimit = globalThis as unknown as { __rateLimitMap?: Map<string, RateLimitRecord> };
const rateLimitMap: Map<string, RateLimitRecord> = globalRateLimit.__rateLimitMap || new Map<string, RateLimitRecord>();
globalRateLimit.__rateLimitMap = rateLimitMap;

// Periodic cleanup of stale entries every 5 minutes in long-running processes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitMap.entries()) {
      record.timestamps = record.timestamps.filter((ts) => now - ts < 60 * 60 * 1000);
      if (record.timestamps.length === 0) {
        rateLimitMap.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
}

/**
 * Synchronous sliding window rate limiter.
 * @param key Unique identifier (e.g. IP address, endpoint:ip)
 * @param limit Maximum allowed requests within the window
 * @param windowMs Duration of the sliding window in milliseconds
 */
export function checkRateLimit(
  key: string,
  limit: number = 5,
  windowMs: number = 15 * 60 * 1000
): RateLimitResult {
  const now = Date.now();
  let record = rateLimitMap.get(key);

  if (!record) {
    record = { timestamps: [] };
    rateLimitMap.set(key, record);
  }

  // Filter timestamps within the current window
  record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

  if (record.timestamps.length >= limit) {
    const oldest = record.timestamps[0];
    const resetSeconds = Math.ceil((oldest + windowMs - now) / 1000);
    return {
      success: false,
      limit,
      remaining: 0,
      resetSeconds: Math.max(1, resetSeconds),
    };
  }

  record.timestamps.push(now);
  return {
    success: true,
    limit,
    remaining: Math.max(0, limit - record.timestamps.length),
    resetSeconds: Math.ceil(windowMs / 1000),
  };
}

/**
 * Durable sliding window rate limiter backed by MongoDB with TTL indexing.
 * Ensures consistent rate limiting across multi-instance serverless deployments (e.g. Vercel).
 * Falls back gracefully to memory rate limiting if database is unavailable.
 */
export async function checkRateLimitDurable(
  key: string,
  limit: number = 5,
  windowMs: number = 15 * 60 * 1000
): Promise<RateLimitResult> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMs);
  const expiresAt = new Date(now.getTime() + windowMs);

  try {
    await connectDB();
    const doc = await RateLimit.findOne({ key });
    const currentTimestamps: Date[] = doc
      ? doc.timestamps.filter((ts) => ts.getTime() > windowStart.getTime())
      : [];

    if (currentTimestamps.length >= limit) {
      const oldest = currentTimestamps[0].getTime();
      const resetSeconds = Math.max(1, Math.ceil((oldest + windowMs - now.getTime()) / 1000));
      return {
        success: false,
        limit,
        remaining: 0,
        resetSeconds,
      };
    }

    currentTimestamps.push(now);

    await RateLimit.findOneAndUpdate(
      { key },
      { $set: { timestamps: currentTimestamps, expiresAt } },
      { upsert: true, new: true }
    );

    return {
      success: true,
      limit,
      remaining: Math.max(0, limit - currentTimestamps.length),
      resetSeconds: Math.ceil(windowMs / 1000),
    };
  } catch (err) {
    // If MongoDB connection fails, fall back to process memory
    console.warn('[RateLimit] Durable check fallback to memory:', err);
    return checkRateLimit(key, limit, windowMs);
  }
}
