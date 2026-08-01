import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { Request, Response } from 'express';
import { getFastRedisClient, withRedisTimeout } from '../config/redis.js';
import { env } from '../config/env.js';
import { AppError } from './errorHandler.js';

// ─── Redis-unavailable policy ──────────────────────────────────────────────────
// By default express-rate-limit rethrows a store error, which the global
// error handler turns into a generic 500 — misrepresenting "we couldn't
// check your rate limit" as an unrelated server crash. Explicit policy
// instead:
//   - /api/contact (IP + email limits) and /api/auth/login: FAIL CLOSED —
//     deny the request with a deliberate, documented error. These protect a
//     public unauthenticated form and a login endpoint; silently letting
//     spam/brute-force through because Redis hiccuped is worse than a
//     temporary outage message.
//   - Everywhere else (the general API limiter): FAIL OPEN — a Redis outage
//     degrades to "no rate limiting" rather than taking down the whole API.

function createRedisStore(prefix: string, failClosed: boolean) {
  return new RedisStore({
    sendCommand: async (command: string, ...args: string[]) => {
      try {
        return (await withRedisTimeout(
          getFastRedisClient().call(command, ...args)
        )) as number;
      } catch (err) {
        if (failClosed) {
          throw new AppError(
            'Service temporarily unavailable. Please try again shortly.',
            503,
            'RATE_LIMIT_UNAVAILABLE'
          );
        }
        throw err; // fail-open limiters set passOnStoreError: true below
      }
    },
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
 * Contact form rate limiter — 5 requests per IP per 15 minutes.
 * Fails closed (see policy above).
 */
export const contactIpRateLimit = rateLimit({
  windowMs: env.RATE_LIMIT_CONTACT_WINDOW_MS,
  max: env.RATE_LIMIT_CONTACT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: createRedisStore('contact-ip', true),
  keyGenerator: (req) => req.ip ?? 'unknown',
  handler: tooManyRequestsResponse,
  skip: () => env.NODE_ENV === 'test',
});

/**
 * Per-email rate limiter — 3 submissions per email per hour.
 * Applied AFTER body parsing so we can key on req.body.email.
 * Fails closed (see policy above).
 */
export const contactEmailRateLimit = rateLimit({
  windowMs: env.RATE_LIMIT_EMAIL_WINDOW_MS,
  max: env.RATE_LIMIT_EMAIL_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: createRedisStore('contact-email', true),
  keyGenerator: (req) => {
    const email = (req.body?.email ?? '') as string;
    return (email.toLowerCase().trim() || req.ip) ?? 'unknown';
  },
  handler: tooManyRequestsResponse,
  skip: () => env.NODE_ENV === 'test',
});

/**
 * Auth endpoint rate limiter — 10 attempts per IP per 15 minutes.
 * Fails closed (see policy above).
 */
export const authRateLimit = rateLimit({
  windowMs: env.RATE_LIMIT_AUTH_WINDOW_MS,
  max: env.RATE_LIMIT_AUTH_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: createRedisStore('auth', true),
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
 * General API rate limiter. Fails open (see policy above) — passOnStoreError
 * makes express-rate-limit swallow the store error and call next() instead
 * of rethrowing it.
 */
export const generalRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: createRedisStore('general', false),
  passOnStoreError: true,
  handler: tooManyRequestsResponse,
  skip: () => env.NODE_ENV === 'test',
});
