import { getRedisClient } from '../../config/redis.js';
import { findPublishedProjects } from './projects.repository.js';
import { logger } from '../../config/logger.js';
import { env } from '../../config/env.js';

const CACHE_KEY = 'projects:published';
const CACHE_TTL_SECONDS = 300; // 5 minutes

export async function getPublishedProjects() {
  // Skip cache in test/development for simplicity
  if (env.NODE_ENV === 'test') {
    return findPublishedProjects();
  }

  try {
    const redis = getRedisClient();
    const cached = await redis.get(CACHE_KEY);
    if (cached) {
      logger.debug('Projects cache hit');
      return JSON.parse(cached) as Awaited<ReturnType<typeof findPublishedProjects>>;
    }
  } catch {
    logger.warn('Redis unavailable — falling back to DB for projects');
  }

  const projects = await findPublishedProjects();

  try {
    const redis = getRedisClient();
    await redis.setex(CACHE_KEY, CACHE_TTL_SECONDS, JSON.stringify(projects));
  } catch {
    // Non-fatal — data was still returned
  }

  return projects;
}

export async function invalidateProjectsCache(): Promise<void> {
  try {
    const redis = getRedisClient();
    await redis.del(CACHE_KEY);
    logger.debug('Projects cache invalidated');
  } catch {
    logger.warn('Failed to invalidate projects cache');
  }
}
