import Redis from 'ioredis';
import { env } from './env.js';
import { logger } from './logger.js';

// All clients this module has ever handed out — tracked so closeRedis() can
// close every one of them on graceful shutdown, regardless of who ended up
// holding the reference (BullMQ Queue/Worker, the rate limiter, ourselves).
const allClients = new Set<Redis>();

function trackClient(client: Redis): Redis {
  allClients.add(client);
  client.on('error', (err) => logger.error({ err }, 'Redis connection error'));
  return client;
}

let baseClient: Redis | null = null;

/**
 * The base connection, configured for BullMQ (maxRetriesPerRequest: null is
 * required by BullMQ's blocking commands — without it, Redis hiccups can
 * silently drop in-flight blocking reads).
 *
 * Do NOT issue commands directly against this instance outside of BullMQ —
 * only use it as the thing createBullmqConnection() duplicates from. Verified
 * directly: with Redis stopped, /api/health (via checkRedisHealth, which used
 * to .ping() this client) and the projects cache (projects.service.ts, which
 * used to .get()/.setex() this client) both hung indefinitely rather than
 * erroring — maxRetriesPerRequest: null means a command just waits forever
 * for reconnection instead of ever rejecting, so their try/catch fallbacks
 * never had anything to catch. Docker's own healthcheck then marked the API
 * container unhealthy purely because Redis was down, even though the API and
 * its database were both fine. See getFastRedisClient() below, which both of
 * those now use instead.
 */
export function getRedisClient(): Redis {
  if (!baseClient) {
    baseClient = trackClient(
      new Redis(env.REDIS_URL, {
        maxRetriesPerRequest: null, // Required by BullMQ
        enableReadyCheck: false,
        lazyConnect: true,
      })
    );
    baseClient.on('connect', () => logger.info('Redis connected'));
  }
  return baseClient;
}

/**
 * A fresh, dedicated connection for a single BullMQ Queue or Worker
 * instance — call once per instance, not shared between them. Each
 * duplicate keeps the base client's BullMQ-required settings
 * (maxRetriesPerRequest: null, enableReadyCheck: false) without being the
 * same connection object as anything else.
 */
export function createBullmqConnection(): Redis {
  return trackClient(getRedisClient().duplicate());
}

let fastClient: Redis | null = null;

/**
 * Shared connection for anything that must fail fast rather than hang when
 * Redis stalls: the rate limiter, the health check, and the projects cache.
 * Deliberately NOT configured like the BullMQ connections —
 * maxRetriesPerRequest: null there would mean a stalled Redis makes these
 * commands hang instead of erroring, which is exactly the bug this client
 * exists to avoid (see getRedisClient()'s doc comment for what that looked
 * like in practice). A short, bounded connectTimeout plus a low retry count
 * means an outage surfaces as a prompt rejection instead, letting each
 * caller's existing fallback (fail-open cache miss, "degraded" health
 * status, or middleware/rateLimiter.ts's explicit fail-open/fail-closed
 * policy) actually run.
 */
export function getFastRedisClient(): Redis {
  if (!fastClient) {
    fastClient = trackClient(
      getRedisClient().duplicate({
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        enableReadyCheck: true,
      })
    );
  }
  return fastClient;
}

/**
 * Caps how long a single fast-client command is allowed to take. ioredis's
 * own connectTimeout/maxRetriesPerRequest bound a single *connection*
 * attempt, but a request path can issue more than one command against the
 * same (still-reconnecting) client — measured directly with Redis stopped:
 * projects.service.ts's cache-read-then-cache-write sequence took ~8s
 * combined (two ~2-4s connect-timeout cycles back to back) before this
 * wrapper existed. Wrapping each individual call gives a hard, predictable
 * ceiling regardless of how many fast-client calls a request happens to
 * make. `promise.catch(() => {})` marks the original promise as handled so
 * a late rejection/resolution after we've already timed out doesn't surface
 * as an unhandled rejection.
 */
export function withRedisTimeout<T>(promise: Promise<T>, ms = 300): Promise<T> {
  promise.catch(() => {});
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Redis operation timed out after ${ms}ms`)), ms);
    }),
  ]);
}

export async function closeRedis(): Promise<void> {
  await Promise.all(
    [...allClients].map((client) =>
      client.quit().catch(() => client.disconnect())
    )
  );
  allClients.clear();
  baseClient = null;
  fastClient = null;
  logger.info('Redis connections closed');
}

export async function checkRedisHealth(): Promise<boolean> {
  try {
    await withRedisTimeout(getFastRedisClient().ping());
    return true;
  } catch {
    return false;
  }
}
