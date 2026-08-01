import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { prisma } from '../src/db/prisma.js';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/lib/hash.js';

const app = createApp();

describe('Auth flow', () => {
  let adminUserId: string;

  beforeAll(async () => {
    // Create test admin user
    const hash = await hashPassword('TestPassword123!');
    const user = await prisma.user.upsert({
      where: { email: 'test-admin@waliliens.com' },
      update: { passwordHash: hash, role: 'ADMIN' },
      create: {
        email: 'test-admin@waliliens.com',
        passwordHash: hash,
        role: 'ADMIN',
        name: 'Test Admin',
      },
    });
    adminUserId = user.id;

    // Create test viewer
    const viewerHash = await hashPassword('ViewerPass123!');
    await prisma.user.upsert({
      where: { email: 'test-viewer@waliliens.com' },
      update: { passwordHash: viewerHash, role: 'VIEWER' },
      create: {
        email: 'test-viewer@waliliens.com',
        passwordHash: viewerHash,
        role: 'VIEWER',
        name: 'Test Viewer',
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email: { in: ['test-admin@waliliens.com', 'test-viewer@waliliens.com'] },
      },
    });
  });

  describe('POST /api/auth/login', () => {
    it('200 — returns access token for valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test-admin@waliliens.com', password: 'TestPassword123!' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.role).toBe('ADMIN');

      // Refresh cookie should be set
      const cookies = res.headers['set-cookie'] as string[] | undefined;
      expect(cookies?.some((c: string) => c.startsWith('waliliens_refresh_token'))).toBe(true);
    });

    it('401 — rejects wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test-admin@waliliens.com', password: 'WrongPassword!' })
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('401 — rejects unknown email (same error as wrong password)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nobody@example.com', password: 'SomePassword!' })
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('Protected routes (JWT gate)', () => {
    let adminToken: string;
    let viewerToken: string;

    beforeAll(async () => {
      // Login as admin
      const adminRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test-admin@waliliens.com', password: 'TestPassword123!' });
      adminToken = adminRes.body.data.accessToken;

      // Login as viewer
      const viewerRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test-viewer@waliliens.com', password: 'ViewerPass123!' });
      viewerToken = viewerRes.body.data.accessToken;
    });

    it('401 — GET /api/admin/leads without token', async () => {
      const res = await request(app)
        .get('/api/admin/leads')
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('401 — GET /api/admin/leads with invalid token', async () => {
      const res = await request(app)
        .get('/api/admin/leads')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('200 — GET /api/admin/leads with valid admin token', async () => {
      const res = await request(app)
        .get('/api/admin/leads')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.leads).toBeDefined();
    });

    it('200 — GET /api/admin/leads with viewer token (read access)', async () => {
      const res = await request(app)
        .get('/api/admin/leads')
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('403 — PATCH /api/admin/leads/:id with viewer token (write restricted)', async () => {
      // Create a test lead first
      const lead = await prisma.lead.create({
        data: {
          name: 'Test',
          email: 'test-lead@example.com',
          projectType: 'web_development',
          message: 'Test message for auth test',
          status: 'new',
        },
      });

      const res = await request(app)
        .patch(`/api/admin/leads/${lead.id}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ status: 'contacted' })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(undefined); // Just 403

      await prisma.lead.delete({ where: { id: lead.id } });
    });

    it('200 — PATCH /api/admin/leads/:id with admin token', async () => {
      const lead = await prisma.lead.create({
        data: {
          name: 'Test',
          email: 'test-lead2@example.com',
          projectType: 'web_development',
          message: 'Test message for admin patch test',
          status: 'new',
        },
      });

      const res = await request(app)
        .patch(`/api/admin/leads/${lead.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'contacted' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('contacted');

      await prisma.lead.delete({ where: { id: lead.id } });
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('200 — issues new access token from valid refresh cookie', async () => {
      // Login to get the cookie
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test-admin@waliliens.com', password: 'TestPassword123!' });

      const cookies = loginRes.headers['set-cookie'] as string[];
      const refreshCookie = cookies.find((c: string) => c.startsWith('waliliens_refresh_token'));

      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', refreshCookie!)
        .expect(200);

      expect(res.body.data.accessToken).toBeDefined();
    });

    it('401 — fails without refresh cookie', async () => {
      await request(app)
        .post('/api/auth/refresh')
        .expect(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('200 — clears the refresh cookie', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('revokes the refresh token — refresh with it after logout returns 401', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test-admin@waliliens.com', password: 'TestPassword123!' });

      const cookies = loginRes.headers['set-cookie'] as string[];
      const refreshCookie = cookies.find((c: string) => c.startsWith('waliliens_refresh_token'));

      // The refresh token still works before logout.
      await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', refreshCookie!)
        .expect(200);

      await request(app)
        .post('/api/auth/logout')
        .set('Cookie', refreshCookie!)
        .expect(200);

      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', refreshCookie!)
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('TOKEN_REVOKED');
    });
  });

  void adminUserId; // used in setup
});
