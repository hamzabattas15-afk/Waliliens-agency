import { beforeAll, afterAll, beforeEach, vi } from 'vitest';

// Set test environment variables
process.env.DATABASE_URL = 'postgresql://waliliens:waliliens_dev_pw@localhost:5432/waliliens_test_db';
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-long-enough-32chars!!';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-long-enough-32chars!';
process.env.RESEND_API_KEY = 're_test_placeholder_key_for_tests';
process.env.EMAIL_FROM = 'test@waliliens.com';
process.env.EMAIL_TO_TEAM = 'team@waliliens.com';
process.env.ALLOWED_ORIGINS = 'http://localhost:3000';

// ── In-memory database tables for test isolation ─────────────────────────────
interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  role: 'ADMIN' | 'VIEWER';
  name: string | null;
  tokenVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

interface LeadRecord {
  id: string;
  name: string;
  email: string;
  projectType: string;
  message: string;
  status: string;
  ipHash?: string | null;
  userAgent?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  referer?: string | null;
  confirmationSentAt?: Date | null;
  teamNotifiedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ProjectRecord {
  id: string;
  title: string;
  slug: string;
  category: string;
  description: string;
  imageUrl: string | null;
  tags: string[];
  published: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

interface AuditLogRecord {
  id: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  before: any;
  after: any;
  ipHash?: string | null;
  createdAt: Date;
}

export const dbState = {
  users: [] as UserRecord[],
  leads: [] as LeadRecord[],
  projects: [] as ProjectRecord[],
  auditLogs: [] as AuditLogRecord[],
};

// Reset memory DB between test runs
export function resetDb() {
  dbState.users = [];
  dbState.leads = [];
  dbState.projects = [];
  dbState.auditLogs = [];
}

// ── Mock Prisma Client ────────────────────────────────────────────────────────
const mockPrisma = {
  user: {
    findUnique: vi.fn(async ({ where }: { where: { email?: string; id?: string } }) => {
      if (where.email) return dbState.users.find((u) => u.email === where.email) ?? null;
      if (where.id) return dbState.users.find((u) => u.id === where.id) ?? null;
      return null;
    }),
    findFirst: vi.fn(async ({ where }: any) => {
      if (where?.email) return dbState.users.find((u) => u.email === where.email) ?? null;
      return dbState.users[0] ?? null;
    }),
    create: vi.fn(async ({ data }: any) => {
      const newUser: UserRecord = {
        id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        email: data.email,
        passwordHash: data.passwordHash,
        role: data.role ?? 'VIEWER',
        name: data.name ?? null,
        tokenVersion: data.tokenVersion ?? 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      dbState.users.push(newUser);
      return newUser;
    }),
    upsert: vi.fn(async ({ where, create, update }: any) => {
      const existing = dbState.users.find((u) => u.email === where.email);
      if (existing) {
        Object.assign(existing, update, { updatedAt: new Date() });
        return existing;
      }
      const newUser: UserRecord = {
        id: create.id ?? `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        email: create.email,
        passwordHash: create.passwordHash,
        role: create.role ?? 'VIEWER',
        name: create.name ?? null,
        tokenVersion: create.tokenVersion ?? 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      dbState.users.push(newUser);
      return newUser;
    }),
    update: vi.fn(async ({ where, data }: any) => {
      const item = dbState.users.find((u) =>
        where.id ? u.id === where.id : u.email === where.email
      );
      if (!item) throw new Error('User not found');
      const nextData = { ...data };
      if (nextData.tokenVersion && typeof nextData.tokenVersion === 'object') {
        nextData.tokenVersion = item.tokenVersion + (nextData.tokenVersion.increment ?? 0);
      }
      Object.assign(item, nextData, { updatedAt: new Date() });
      return item;
    }),
    deleteMany: vi.fn(async (args?: any) => {
      if (args?.where?.email?.in) {
        dbState.users = dbState.users.filter((u) => !args.where.email.in.includes(u.email));
      } else {
        dbState.users = [];
      }
      return { count: dbState.users.length };
    }),
  },

  lead: {
    create: vi.fn(async ({ data }: any) => {
      const newLead: LeadRecord = {
        id: data.id ?? `lead-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: data.name,
        email: data.email,
        projectType: data.projectType,
        message: data.message,
        status: data.status ?? 'new',
        ipHash: data.ipHash ?? null,
        userAgent: data.userAgent ?? null,
        utmSource: data.utmSource ?? null,
        utmMedium: data.utmMedium ?? null,
        utmCampaign: data.utmCampaign ?? null,
        referer: data.referer ?? null,
        confirmationSentAt: data.confirmationSentAt ?? null,
        teamNotifiedAt: data.teamNotifiedAt ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      dbState.leads.push(newLead);
      return newLead;
    }),
    findFirst: vi.fn(async ({ where }: any) => {
      if (where?.email) return dbState.leads.find((l) => l.email === where.email) ?? null;
      return dbState.leads[0] ?? null;
    }),
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
      return dbState.leads.find((l) => l.id === where.id) ?? null;
    }),
    findMany: vi.fn(async (args?: any) => {
      let result = [...dbState.leads];
      if (args?.where?.status) {
        result = result.filter((l) => l.status === args.where.status);
      }
      if (args?.where?.projectType) {
        result = result.filter((l) => l.projectType === args.where.projectType);
      }
      if (args?.skip) {
        result = result.slice(args.skip);
      }
      if (args?.take) {
        result = result.slice(0, args.take);
      }
      return result;
    }),
    count: vi.fn(async () => dbState.leads.length),
    update: vi.fn(async ({ where, data }: any) => {
      const item = dbState.leads.find((l) => l.id === where.id);
      if (!item) throw new Error('Lead not found');
      Object.assign(item, data, { updatedAt: new Date() });
      return item;
    }),
    delete: vi.fn(async ({ where }: { where: { id: string } }) => {
      const idx = dbState.leads.findIndex((l) => l.id === where.id);
      if (idx !== -1) {
        const deleted = dbState.leads.splice(idx, 1)[0];
        return deleted;
      }
      throw new Error('Lead not found');
    }),
    deleteMany: vi.fn(async () => {
      dbState.leads = [];
      return { count: 0 };
    }),
  },

  project: {
    findMany: vi.fn(async () => dbState.projects),
    findUnique: vi.fn(async ({ where }: { where: { id?: string; slug?: string } }) => {
      if (where.slug) return dbState.projects.find((p) => p.slug === where.slug) ?? null;
      if (where.id) return dbState.projects.find((p) => p.id === where.id) ?? null;
      return null;
    }),
    create: vi.fn(async ({ data }: any) => {
      const newProj: ProjectRecord = {
        id: `proj-${Date.now()}`,
        title: data.title,
        slug: data.slug,
        category: data.category,
        description: data.description,
        imageUrl: data.imageUrl ?? null,
        tags: data.tags ?? [],
        published: data.published ?? false,
        sortOrder: data.sortOrder ?? 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      dbState.projects.push(newProj);
      return newProj;
    }),
    update: vi.fn(async ({ where, data }: any) => {
      const item = dbState.projects.find((p) => p.id === where.id);
      if (!item) throw new Error('Project not found');
      Object.assign(item, data, { updatedAt: new Date() });
      return item;
    }),
    delete: vi.fn(async ({ where }: { where: { id: string } }) => {
      const idx = dbState.projects.findIndex((p) => p.id === where.id);
      if (idx !== -1) {
        return dbState.projects.splice(idx, 1)[0];
      }
      throw new Error('Project not found');
    }),
    deleteMany: vi.fn(async () => {
      dbState.projects = [];
      return { count: 0 };
    }),
  },

  auditLog: {
    create: vi.fn(async ({ data }: any) => {
      const log: AuditLogRecord = {
        id: `audit-${Date.now()}`,
        userId: data.userId,
        action: data.action,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        before: data.before,
        after: data.after,
        ipHash: data.ipHash ?? null,
        createdAt: new Date(),
      };
      dbState.auditLogs.push(log);
      return log;
    }),
    deleteMany: vi.fn(async () => {
      dbState.auditLogs = [];
      return { count: 0 };
    }),
  },

  $transaction: vi.fn(async (arg: any) => {
    if (Array.isArray(arg)) {
      return Promise.all(arg);
    }
    return arg(mockPrisma);
  }),
  $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]),
  $disconnect: vi.fn().mockResolvedValue(undefined),
};

// ── Mock DB module ─────────────────────────────────────────────────────────────
// Resolved relative to this file (tests/helpers/setup.ts): up to tests/, up to
// backend/, then into src/db/prisma.js — vi.mock intercepts by the module's
// resolved absolute path, so every importer (src/app.ts, tests/*.test.ts, etc.)
// picks up this mock regardless of the relative specifier *they* use.
vi.mock('../../src/db/prisma.js', () => ({
  prisma: mockPrisma,
  checkDatabaseHealth: vi.fn().mockResolvedValue(true),
}));

// ── Mock Redis ────────────────────────────────────────────────────────────────
vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    ping: vi.fn().mockResolvedValue('PONG'),
    get: vi.fn().mockResolvedValue(null),
    setex: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    call: vi.fn().mockResolvedValue(0),
    quit: vi.fn().mockResolvedValue('OK'),
    connect: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('rate-limit-redis', () => ({
  RedisStore: vi.fn().mockImplementation(() => ({
    init: vi.fn(),
    increment: vi.fn().mockResolvedValue({ totalHits: 1, resetTime: new Date(Date.now() + 60000) }),
    decrement: vi.fn(),
    resetKey: vi.fn(),
  })),
}));

vi.mock('../../src/config/redis.js', () => ({
  getRedisClient: () => ({
    ping: vi.fn().mockResolvedValue('PONG'),
    get: vi.fn().mockResolvedValue(null),
    setex: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    call: vi.fn().mockResolvedValue(0),
    quit: vi.fn().mockResolvedValue('OK'),
  }),
  closeRedis: vi.fn().mockResolvedValue(undefined),
  checkRedisHealth: vi.fn().mockResolvedValue(true),
}));

// ── Mock BullMQ queue ─────────────────────────────────────────────────────────
vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({ id: 'job-1' }),
    close: vi.fn().mockResolvedValue(undefined),
  })),
  Worker: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../../src/lib/queue.js', () => ({
  getEmailQueue: vi.fn(),
  enqueueConfirmationEmail: vi.fn().mockResolvedValue(undefined),
  enqueueTeamNotification: vi.fn().mockResolvedValue(undefined),
  QUEUE_NAMES: { EMAIL: 'email' },
  JOB_NAMES: {
    SEND_CONFIRMATION: 'send-confirmation',
    SEND_TEAM_NOTIFY: 'send-team-notify',
  },
}));

beforeAll(async () => {
  resetDb();
});

beforeEach(() => {
  // Clear mock call counts
  vi.clearAllMocks();
});

afterAll(async () => {
  resetDb();
});
