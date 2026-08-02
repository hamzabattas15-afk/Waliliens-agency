import { env } from './config/env.js';
import { logger } from './config/logger.js';

// Registered before anything else is imported. ES module `import` statements
// are hoisted and fully evaluated before this file's own top-level code runs
// — including code textually above them — so anything pulled in via a static
// import here would already have had its chance to crash the process before
// these handlers could be registered. And it does: rate-limit-redis's
// RedisStore constructor (built for every limiter in middleware/rateLimiter.ts,
// which app.ts imports transitively) fires off its Lua script load
// (`this.incrementScriptSha = this.loadIncrementScript()`) without awaiting
// or catching it — a rejected promise there (e.g. the Redis call in
// config/redis.ts's getFastRedisClient() exceeding withRedisTimeout's 300ms
// on the container network) is unhandled and fatal. Dynamic `import()` below
// runs in place instead of being hoisted, so it happens after these are wired.
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception — shutting down');
  process.exit(1);
});

async function main() {
  const { createApp } = await import('./app.js');
  const { prisma } = await import('./db/prisma.js');
  const { closeRedis, getRedisClient } = await import('./config/redis.js');
  const { startEmailWorker } = await import('./jobs/emailWorker.js');

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
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
