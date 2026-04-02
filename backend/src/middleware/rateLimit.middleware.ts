import rateLimit from 'express-rate-limit';
import { Request } from 'express';


/**
 * General API rate limiter — 300 requests per 15 minutes
 * Skips high-frequency internal polling routes
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // ✅ Increased from 100 → 300
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // ✅ Skip rate limiting for high-frequency polling routes
  skip: (req: Request) => {
    const skippedPaths = [
      '/api/v1/status/activity',     // pings every 30s
      '/api/v1/status',              // polled for status display
      '/api/v1/session/status',      // WhatsApp session check
    ];
    return skippedPaths.some(path => req.path === path || req.originalUrl.startsWith(path));
  },
});


/**
 * Auth rate limiter — strict, 10 attempts per 15 minutes
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // ✅ Increased from 5 → 10 (5 was too strict for dev)
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: 'Too many login attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});


/**
 * Relaxed limiter for read-heavy routes (conversations, activity, dashboard)
 * These get polled frequently by the frontend
 */
export const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});