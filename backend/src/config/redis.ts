import { Redis } from 'ioredis';

if (!process.env.REDIS_URL) {
    throw new Error('REDIS_URL is not defined in environment variables');
}

// Create Redis connection
export const redis = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
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