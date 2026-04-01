import { Redis } from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();


if (!process.env.REDIS_URL) {
  throw new Error('REDIS_URL is not defined in environment variables');
}


// Create Redis connection
export const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,   // required for BullMQ
  enableReadyCheck: false,      // required for BullMQ
  tls: {},                      // required for Upstash rediss:// TLS connections
  family: 0,                    // enables dual-stack IPv4+IPv6 DNS lookup — fixes ENOTFOUND
  connectTimeout: 30000,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
});


redis.on('connect', () => {
  console.log('✅ Redis Connected Successfully');
});


redis.on('error', (err) => {
  console.error('❌ Redis Connection Error:', err);
});


redis.on('close', () => {
  console.warn('⚠️ Redis Connection Closed');
});


export default redis;
