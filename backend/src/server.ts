import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { prisma } from './db/prisma.js';
import { closeRedis, getRedisClient } from './config/redis.js';
import { startEmailWorker } from './jobs/emailWorker.js';

async function main() {
  // Connect to Redis early (BullMQ needs it)
  const redis = getRedisClient();
  await redis.connect().catch(() => {
    // Redis may already be connected — ignore ECONNREFUSED on connect()
  });

  const app = createApp();

  // Start BullMQ email worker in the same process
  // For high-traffic production, extract this to a separate worker process
  const worker = startEmailWorker();

  const server = app.listen(env.PORT, () => {
    logger.info(
      {
        port: env.PORT,
        env: env.NODE_ENV,
        docs: `http://localhost:${env.PORT}/api/docs`,
      },
      '🚀 Waliliens API server started'
    );
  });

  // ── Graceful shutdown ───────────────────────────────────────────────────────
  async function shutdown(signal: string) {
    logger.info({ signal }, 'Shutdown signal received');

    // Stop accepting new connections
    server.close(async () => {
      logger.info('HTTP server closed');

      // Close worker
      await worker.close();
      logger.info('BullMQ worker closed');

      // Close DB
      await prisma.$disconnect();
      logger.info('Database disconnected');

      // Close Redis
      await closeRedis();
      logger.info('Redis disconnected');

      process.exit(0);
    });

    // Force shutdown after 10s
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled promise rejection');
  });

  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception — shutting down');
    process.exit(1);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
