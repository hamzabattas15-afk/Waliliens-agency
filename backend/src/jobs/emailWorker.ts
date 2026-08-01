import { Worker, Job } from 'bullmq';
import { createBullmqConnection } from '../config/redis.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';
import {
  QUEUE_NAMES,
  JOB_NAMES,
  ConfirmationJobData,
  TeamNotifyJobData,
} from '../lib/queue.js';
import {
  sendEmail,
  buildConfirmationEmail,
  buildTeamNotificationEmail,
} from '../lib/mailer.js';
import { prisma } from '../db/prisma.js';

// ─── Job handlers ─────────────────────────────────────────────────────────────

async function handleConfirmationEmail(job: Job<ConfirmationJobData>): Promise<void> {
  const { leadId, name, email } = job.data;
  logger.info({ jobId: job.id, leadId }, 'Sending confirmation email');

  await sendEmail({
    to: email,
    subject: 'Waliliens — Votre demande a bien été reçue ✓',
    html: buildConfirmationEmail(name),
    replyTo: env.EMAIL_TO_TEAM,
  });

  // Mark as sent in the DB
  await prisma.lead.update({
    where: { id: leadId },
    data: { confirmationSentAt: new Date() },
  });

  logger.info({ jobId: job.id, leadId }, 'Confirmation email sent');
}

async function handleTeamNotification(job: Job<TeamNotifyJobData>): Promise<void> {
  const { leadId, name, email, projectType, message } = job.data;
  logger.info({ jobId: job.id, leadId }, 'Sending team notification');

  // 1) Email to team
  await sendEmail({
    to: env.EMAIL_TO_TEAM,
    subject: `[Waliliens] Nouveau lead: ${name} — ${projectType}`,
    html: buildTeamNotificationEmail({ leadId, name, email, projectType, message }),
    replyTo: email,
  });

  // 2) Optional Slack webhook
  if (env.SLACK_WEBHOOK_URL) {
    try {
      const projectTypeLabels: Record<string, string> = {
        web_development: '🌐 Web Development',
        ai_automation: '🤖 AI Automation',
        both: '🌐🤖 Both',
      };

      await fetch(env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `*New lead from ${name}* (${email})\n*Type:* ${projectTypeLabels[projectType] ?? projectType}\n*Message:* ${message.slice(0, 200)}${message.length > 200 ? '...' : ''}\n*Lead ID:* \`${leadId}\``,
        }),
      });
      logger.info({ jobId: job.id, leadId }, 'Slack notification sent');
    } catch (slackErr) {
      // Non-fatal — log but don't fail the job
      logger.warn({ err: slackErr, leadId }, 'Slack notification failed');
    }
  }

  // Mark as notified in the DB
  await prisma.lead.update({
    where: { id: leadId },
    data: { teamNotifiedAt: new Date() },
  });

  logger.info({ jobId: job.id, leadId }, 'Team notification complete');
}

// ─── Worker factory ───────────────────────────────────────────────────────────

export function startEmailWorker(): Worker {
  const worker = new Worker(
    QUEUE_NAMES.EMAIL,
    async (job: Job) => {
      switch (job.name) {
        case JOB_NAMES.SEND_CONFIRMATION:
          return handleConfirmationEmail(job as Job<ConfirmationJobData>);
        case JOB_NAMES.SEND_TEAM_NOTIFY:
          return handleTeamNotification(job as Job<TeamNotifyJobData>);
        default:
          logger.warn({ jobName: job.name }, 'Unknown job type — skipping');
      }
    },
    {
      connection: createBullmqConnection(),
      concurrency: 5,
    }
  );

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id, jobName: job.name }, 'Email job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, jobName: job?.name, err },
      'Email job failed'
    );
  });

  logger.info('Email worker started');
  return worker;
}
