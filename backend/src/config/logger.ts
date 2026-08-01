import pino from 'pino';
import { createRequire } from 'node:module';
import { env } from './env.js';

// pino-pretty is a devDependency, absent from the production image. Resolving
// it (without loading it) tells us whether pino's transport worker thread
// would actually be able to require it — if not, fall back to plain JSON
// rather than letting pino crash the process trying to spawn that worker.
function isPinoPrettyAvailable(): boolean {
  try {
    createRequire(import.meta.url).resolve('pino-pretty');
    return true;
  } catch {
    return false;
  }
}

const usePrettyTransport = env.NODE_ENV === 'development' && isPinoPrettyAvailable();

export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : 'info',
  ...(usePrettyTransport
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        },
      }
    : {
        // Production (or dev without pino-pretty installed): structured JSON.
        formatters: {
          level(label) {
            return { level: label };
          },
        },
        timestamp: pino.stdTimeFunctions.isoTime,
      }),
});

export type Logger = typeof logger;
