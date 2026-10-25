import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.NODE_ENV === 'test' ? 500 : 25,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts. Please wait 15 minutes before trying again.',
    },
  },
});

export const searchRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: env.NODE_ENV === 'test' ? 1000 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many search requests. Please wait a moment and try again.',
    },
  },
});

export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: env.NODE_ENV === 'test' ? 1000 : 120,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many API requests. Please slow down.',
    },
  },
});
