import { Request } from 'express';
import { prisma } from '../db/prisma.js';
import { hashIp } from '../lib/hash.js';
import { logger } from '../config/logger.js';

export interface AuditLogEntry {
  action: string;
  resourceType: string;
  resourceId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

/**
 * Write an entry to the audit log table.
 * This function is fire-and-forget — errors are logged but do not
 * propagate to the caller.
 */
export async function writeAuditLog(
  req: Request,
  userId: string,
  entry: AuditLogEntry
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        before: (entry.before as any) ?? undefined,
        after: (entry.after as any) ?? undefined,
        ipHash: req.ip ? hashIp(req.ip) : undefined,
      },
    });
  } catch (err) {
    // Audit log failures must never crash the main request
    logger.error({ err, entry }, 'Failed to write audit log');
  }
}
