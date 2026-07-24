import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger.js';
import { reportError } from '../lib/errorReporter.js';

// Custom application error class
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;

  constructor(
    message: string,
    statusCode: number = 500,
    code?: string,
    isOperational = true
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

export interface ApiErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
    details?: unknown;
  };
}

/**
 * Central error handling middleware.
 * Must be registered LAST in Express middleware chain.
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  // Zod validation errors (from zod-express or manual parsing)
  if (err.name === 'ZodError') {
    res.status(422).json({
      success: false,
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: JSON.parse(err.message),
      },
    } satisfies ApiErrorResponse);
    return;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    res.status(401).json({
      success: false,
      error: {
        message: 'Invalid or expired token',
        code: 'AUTH_ERROR',
      },
    } satisfies ApiErrorResponse);
    return;
  }

  // Operational AppErrors (known, expected errors)
  if (err instanceof AppError && err.isOperational) {
    logger.warn({ statusCode: err.statusCode, message: err.message }, 'Operational error');
    res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        code: err.code,
      },
    } satisfies ApiErrorResponse);
    return;
  }

  // Unexpected errors — report to Sentry + log
  reportError(err, {
    requestId: req.headers['x-request-id'] as string,
    method: req.method,
    url: req.url,
  }).catch(() => {
    // Prevent error in error handler
  });

  // In production, hide internal error details
  const message =
    process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : err.message;

  res.status(500).json({
    success: false,
    error: {
      message,
      code: 'INTERNAL_ERROR',
    },
  } satisfies ApiErrorResponse);
}
