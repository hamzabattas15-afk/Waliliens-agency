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
import { errorHandler } from './middleware/errorHandler.js';
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
            'https://cdnjs.cloudflare.com', // GSAP + Lenis
            'https://challenges.cloudflare.com', // Turnstile
          ],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            'https://fonts.googleapis.com',
          ],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
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
        return callback(new Error(`CORS: origin ${origin} not allowed`), false);
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

  // ── OpenAPI / Swagger UI ──────────────────────────────────────────────────────
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
    apis: ['./src/modules/**/*.route.ts', './src/app.ts'],
  });

  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customSiteTitle: 'Waliliens API Docs',
    })
  );

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
