import { Queue } from 'bullmq';
import { createBullmqConnection } from '../config/redis.js';

// ─── Queue definitions ────────────────────────────────────────────────────────

export const QUEUE_NAMES = {
  EMAIL: 'email',
} as const;

export const JOB_NAMES = {
  SEND_CONFIRMATION: 'send-confirmation',
  SEND_TEAM_NOTIFY: 'send-team-notify',
} as const;

// ─── Job data types ───────────────────────────────────────────────────────────

export interface ConfirmationJobData {
  leadId: string;
  name: string;
  email: string;
}

export interface TeamNotifyJobData {
  leadId: string;
  name: string;
  email: string;
  projectType: string;
  message: string;
}

export type EmailJobData = ConfirmationJobData | TeamNotifyJobData;

// ─── Queue instance ───────────────────────────────────────────────────────────

let emailQueue: Queue | null = null;

export function getEmailQueue(): Queue {
  if (!emailQueue) {
    emailQueue = new Queue(QUEUE_NAMES.EMAIL, {
      connection: createBullmqConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000, // 5s, 10s, 20s
        },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    });
  }
  return emailQueue;
}

export async function enqueueConfirmationEmail(
  data: ConfirmationJobData
): Promise<void> {
  const queue = getEmailQueue();
  await queue.add(JOB_NAMES.SEND_CONFIRMATION, data, {
    jobId: `confirmation-${data.leadId}`, // deduplicate
  });
}

export async function enqueueTeamNotification(
  data: TeamNotifyJobData
): Promise<void> {
  const queue = getEmailQueue();
  await queue.add(JOB_NAMES.SEND_TEAM_NOTIFY, data, {
    jobId: `team-notify-${data.leadId}`, // deduplicate
  });
}
