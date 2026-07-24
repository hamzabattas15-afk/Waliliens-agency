import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { Request, Response } from 'express';
import { getRedisClient } from '../config/redis.js';
import { env } from '../config/env.js';

function createRedisStore(prefix: string) {
  return new RedisStore({
    sendCommand: (command: string, ...args: string[]) =>
      getRedisClient().call(command, ...args) as Promise<number>,
    prefix: `rl:${prefix}:`,
  });
}

function tooManyRequestsResponse(_req: Request, res: Response): void {
  res.status(429).json({
    success: false,
    error: {
      message: 'Trop de requêtes. Veuillez réessayer plus tard.',
      code: 'RATE_LIMIT_EXCEEDED',
    },
  });
}

/**
 * Contact form rate limiter — 5 requests per IP per 15 minutes
 */
export const contactIpRateLimit = rateLimit({
  windowMs: env.RATE_LIMIT_CONTACT_WINDOW_MS,
  max: env.RATE_LIMIT_CONTACT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: createRedisStore('contact-ip'),
  keyGenerator: (req) => req.ip ?? 'unknown',
  handler: tooManyRequestsResponse,
  skip: () => env.NODE_ENV === 'test',
});

/**
 * Per-email rate limiter — 3 submissions per email per hour.
 * Applied AFTER body parsing so we can key on req.body.email.
 */
export const contactEmailRateLimit = rateLimit({
  windowMs: env.RATE_LIMIT_EMAIL_WINDOW_MS,
  max: env.RATE_LIMIT_EMAIL_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: createRedisStore('contact-email'),
  keyGenerator: (req) => {
    const email = (req.body?.email ?? '') as string;
    return (email.toLowerCase().trim() || req.ip) ?? 'unknown';
  },
  handler: tooManyRequestsResponse,
  skip: () => env.NODE_ENV === 'test',
});

/**
 * Auth endpoint rate limiter — 10 attempts per IP per 15 minutes
 */
export const authRateLimit = rateLimit({
  windowMs: env.RATE_LIMIT_AUTH_WINDOW_MS,
  max: env.RATE_LIMIT_AUTH_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: createRedisStore('auth'),
  keyGenerator: (req) => req.ip ?? 'unknown',
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: {
        message: 'Too many login attempts. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
      },
    });
  },
  skip: () => env.NODE_ENV === 'test',
});

/**
 * General API rate limiter
 */
export const generalRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: createRedisStore('general'),
  handler: tooManyRequestsResponse,
  skip: () => env.NODE_ENV === 'test',
});
