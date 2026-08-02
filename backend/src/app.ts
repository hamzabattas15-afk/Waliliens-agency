import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { checkDatabaseHealth } from './db/prisma.js';
import { checkRedisHealth } from './config/redis.js';
import { AppError, errorHandler } from './middleware/errorHandler.js';
import { generalRateLimit } from './middleware/rateLimiter.js';

// Module routes
import contactRouter from './modules/contact/contact.route.js';
import authRouter from './modules/auth/auth.route.js';
import leadsRouter from './modules/leads/leads.route.js';
import {
  publicProjectsRouter,
  adminProjectsRouter,
} from './modules/projects/projects.route.js';

export function createApp() {
  const app = express();

  // ── Trust proxy (required for correct IP when behind nginx/cloud LB) ────────
  app.set('trust proxy', 1);

  // ── Security headers ─────────────────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            'https://cdnjs.cloudflare.com', // GSAP
            'https://challenges.cloudflare.com', // Turnstile
          ],
          styleSrc: ["'self'", "'unsafe-inline'"],
          // Fonts are self-hosted under frontend/fonts/ (see
          // politique-confidentialite.html) — no fonts.gstatic.com needed.
          fontSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          frameSrc: ['https://challenges.cloudflare.com'], // Turnstile iframe
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false, // Needed for Swagger UI to load assets
    })
  );

  // ── CORS ─────────────────────────────────────────────────────────────────────
  const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (server-to-server, curl)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(
          new AppError(`CORS: origin ${origin} not allowed`, 403, 'CORS_NOT_ALLOWED'),
          false
        );
      },
      credentials: true, // Allow cookies (refresh token)
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'cf-turnstile-response'],
    })
  );

  // ── Request logging ───────────────────────────────────────────────────────────
  if (env.NODE_ENV !== 'test') {
    app.use(
      pinoHttp({
        logger,
        customLogLevel: (_req, res) => {
          if (res.statusCode >= 500) return 'error';
          if (res.statusCode >= 400) return 'warn';
          return 'info';
        },
      })
    );
  }

  // ── Body parsing ──────────────────────────────────────────────────────────────
  // Admin project payloads (description alone allows up to 10000 chars) can
  // exceed the global 10kb default — give that route its own larger parser.
  // Mounted before the global one: body-parser skips re-parsing a body it's
  // already parsed (see body-parser/lib/types/json.js), so this only raises
  // the limit for /api/admin/projects — every other route, in particular
  // /api/contact, still hits the global parser below and keeps the tight
  // 10kb limit.
  app.use('/api/admin/projects', express.json({ limit: '100kb' }));
  app.use(express.json({ limit: '10kb' })); // Limit to prevent large payload attacks
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));
  app.use(cookieParser());

  // ── General rate limit (all API routes) ──────────────────────────────────────
  app.use('/api', generalRateLimit);

  // ── Health check ──────────────────────────────────────────────────────────────
  /**
   * @openapi
   * /api/health:
   *   get:
   *     tags: [System]
   *     summary: Check API + DB + Redis health
   *     responses:
   *       200:
   *         description: All systems operational
   *       503:
   *         description: One or more systems degraded
   */
  app.get('/api/health', async (_req: Request, res: Response) => {
    const [dbOk, redisOk] = await Promise.all([
      checkDatabaseHealth(),
      checkRedisHealth(),
    ]);

    const status = dbOk && redisOk ? 'ok' : 'degraded';
    const httpStatus = status === 'ok' ? 200 : 503;

    res.status(httpStatus).json({
      status,
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      services: {
        database: dbOk ? 'ok' : 'error',
        redis: redisOk ? 'ok' : 'error',
      },
    });
  });

  // ── API routes ────────────────────────────────────────────────────────────────
  app.use('/api/contact', contactRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/projects', publicProjectsRouter);

  // Admin routes
  app.use('/api/admin/leads', leadsRouter);
  app.use('/api/admin/projects', adminProjectsRouter);

  // ── OpenAPI / Swagger UI (non-production only) ───────────────────────────────
  // Interactive docs expose the full route/schema surface — not something to
  // serve publicly in production. Skipping spec generation entirely there also
  // avoids the glob scan below running in the shipped image.
  if (env.NODE_ENV !== 'production') {
    const swaggerSpec = swaggerJSDoc({
      definition: {
        openapi: '3.0.0',
        info: {
          title: 'Waliliens API',
          version: '1.0.0',
          description:
            'Backend API for the Waliliens agency website. Handles contact form submissions, lead management, portfolio CMS, and admin authentication.',
          contact: {
            email: 'hello@waliliens.com',
          },
        },
        servers: [
          {
            url: `http://localhost:${env.PORT}`,
            description: 'Local development',
          },
          {
            url: 'https://api.waliliens.com',
            description: 'Production',
          },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
            },
          },
        },
      },
      // These globs are resolved relative to `process.cwd()`, not this file —
      // they only find the @openapi JSDoc comments because the Dockerfile's
      // runner stage copies the original src/ tree alongside dist/ (see
      // backend/Dockerfile) AND the container's WORKDIR/CWD is the app root
      // both hold. Running the compiled server with a different working
      // directory, or dropping that src/ COPY, silently empties the docs
      // (swagger-jsdoc finds no matches — it doesn't error) rather than
      // failing loudly.
      apis: ['./src/modules/**/*.route.ts', './src/app.ts'],
    });

    app.use(
      '/api/docs',
      swaggerUi.serve,
      swaggerUi.setup(swaggerSpec, {
        customSiteTitle: 'Waliliens API Docs',
      })
    );
  }

  // ── 404 handler ───────────────────────────────────────────────────────────────
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: {
        message: `Route ${req.method} ${req.path} not found`,
        code: 'NOT_FOUND',
      },
    });
  });

  // ── Global error handler (must be last) ───────────────────────────────────────
  app.use(errorHandler);

  return app;
}
