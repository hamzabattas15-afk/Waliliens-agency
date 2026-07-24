import { Request } from 'express';
import { ProjectType } from '@prisma/client';
import { ContactInput, projectTypeToDb } from './contact.schema.js';
import { createLead } from './contact.repository.js';
import {
  enqueueConfirmationEmail,
  enqueueTeamNotification,
} from '../../lib/queue.js';
import { hashIp } from '../../lib/hash.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

// ─── Optional: Cloudflare Turnstile verification ──────────────────────────────

export async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  if (!env.TURNSTILE_SECRET_KEY) {
    // Turnstile not configured — skip verification
    return true;
  }

  const formData = new FormData();
  formData.append('secret', env.TURNSTILE_SECRET_KEY);
  formData.append('response', token);
  formData.append('remoteip', ip);

  const response = await fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    { method: 'POST', body: formData }
  );

  const result = (await response.json()) as { success: boolean };
  return result.success;
}

// ─── Main contact service ─────────────────────────────────────────────────────

export async function processContactSubmission(
  input: ContactInput,
  req: Request
): Promise<{ id: string }> {
  const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown';

  // Map frontend value to DB enum
  const dbProjectType = projectTypeToDb[input.projectType] as ProjectType;

  // Extract metadata
  const ipHash = hashIp(ip);
  const userAgent = req.headers['user-agent']?.slice(0, 500);
  const referer = req.headers['referer']?.slice(0, 500);

  // Persist lead
  const lead = await createLead({
    name: input.name,
    email: input.email,
    projectType: dbProjectType,
    message: input.message,
    ipHash,
    userAgent,
    utmSource: input.utm_source,
    utmMedium: input.utm_medium,
    utmCampaign: input.utm_campaign,
    referer,
  });

  logger.info(
    { leadId: lead.id, projectType: input.projectType },
    'New lead created'
  );

  // Enqueue background email jobs (fire-and-forget from request perspective)
  await Promise.allSettled([
    enqueueConfirmationEmail({
      leadId: lead.id,
      name: lead.name,
      email: lead.email,
    }),
    enqueueTeamNotification({
      leadId: lead.id,
      name: lead.name,
      email: lead.email,
      projectType: lead.projectType,
      message: input.message,
    }),
  ]);

  return { id: lead.id };
}
