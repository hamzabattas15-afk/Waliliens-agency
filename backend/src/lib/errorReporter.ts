import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

export interface ErrorContext {
  userId?: string;
  requestId?: string;
  [key: string]: unknown;
}

// Lazy Sentry import — only loaded if SENTRY_DSN is set
let sentryInitialized = false;

async function initSentry(): Promise<void> {
  if (sentryInitialized || !env.SENTRY_DSN) return;

  try {
    const Sentry = await import('@sentry/node');
    Sentry.init({
      dsn: env.SENTRY_DSN,
      environment: env.NODE_ENV,
      tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,
    });
    sentryInitialized = true;
    logger.info('Sentry error tracking initialized');
  } catch {
    logger.warn('Sentry SDK not available — install @sentry/node to enable error tracking');
  }
}

// Initialize on first import if DSN is configured
if (env.SENTRY_DSN) {
  initSentry().catch(() => {
    // Non-fatal — app continues without Sentry
  });
}

export async function reportError(
  error: Error,
  context?: ErrorContext
): Promise<void> {
  // Always log to pino
  logger.error({ err: error, ...context }, error.message);

  // Forward to Sentry if available
  if (env.SENTRY_DSN && sentryInitialized) {
    try {
      const Sentry = await import('@sentry/node');
      Sentry.withScope((scope) => {
        if (context?.userId) scope.setUser({ id: context.userId });
        if (context) scope.setExtras(context);
        Sentry.captureException(error);
      });
    } catch {
      // Sentry reporting failed — already logged above
    }
  }
}

export async function reportMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  context?: ErrorContext
): Promise<void> {
  const pinoLevel = level === 'warning' ? 'warn' : level;
  logger[pinoLevel]({ ...context }, message);

  if (env.SENTRY_DSN && sentryInitialized) {
    try {
      const Sentry = await import('@sentry/node');
      Sentry.captureMessage(message, level === 'warning' ? 'warning' : level);
    } catch {
      // silent
    }
  }
}
