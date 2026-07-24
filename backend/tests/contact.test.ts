import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { prisma } from '../src/db/prisma.js';
import { createApp } from '../src/app.js';

const app = createApp();

describe('POST /api/contact', () => {
  beforeEach(async () => {
    await prisma.lead.deleteMany();
  });

  const validPayload = {
    name: 'Alice Dupont',
    email: 'alice@example.com',
    projectType: 'web-development',
    message: 'Nous cherchons à refondre notre site e-commerce avec un focus sur les performances.',
  };

  it('201 — creates a lead for a valid payload', async () => {
    const res = await request(app)
      .post('/api/contact')
      .send(validPayload)
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();

    const lead = await prisma.lead.findFirst({ where: { email: validPayload.email } });
    expect(lead).not.toBeNull();
    expect(lead!.projectType).toBe('web_development');
    expect(lead!.status).toBe('new');
  });

  it('201 — creates a lead for ai-automation project type', async () => {
    const res = await request(app)
      .post('/api/contact')
      .send({ ...validPayload, projectType: 'ai-automation', email: 'bob@example.com' })
      .expect(201);

    expect(res.body.success).toBe(true);
    const lead = await prisma.lead.findFirst({ where: { email: 'bob@example.com' } });
    expect(lead!.projectType).toBe('ai_automation');
  });

  it('201 — creates a lead for "both" project type', async () => {
    const res = await request(app)
      .post('/api/contact')
      .send({ ...validPayload, projectType: 'both', email: 'carol@example.com' })
      .expect(201);

    expect(res.body.success).toBe(true);
  });

  it('422 — rejects when name is missing', async () => {
    const { name: _name, ...noName } = validPayload;
    const res = await request(app)
      .post('/api/contact')
      .send(noName)
      .expect(422);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('422 — rejects when email is invalid', async () => {
    const res = await request(app)
      .post('/api/contact')
      .send({ ...validPayload, email: 'not-an-email' })
      .expect(422);

    expect(res.body.success).toBe(false);
  });

  it('422 — rejects invalid projectType enum value', async () => {
    const res = await request(app)
      .post('/api/contact')
      .send({ ...validPayload, projectType: 'invalid-type' })
      .expect(422);

    expect(res.body.success).toBe(false);
  });

  it('422 — rejects message that is too short', async () => {
    const res = await request(app)
      .post('/api/contact')
      .send({ ...validPayload, message: 'Hi' })
      .expect(422);

    expect(res.body.success).toBe(false);
  });

  it('200 — silently accepts (honeypot filled) without creating a lead', async () => {
    const beforeCount = await prisma.lead.count();

    const res = await request(app)
      .post('/api/contact')
      .send({ ...validPayload, _hp: 'I am a bot' })
      .expect(200);

    expect(res.body.success).toBe(true);

    // No lead should have been created
    const afterCount = await prisma.lead.count();
    expect(afterCount).toBe(beforeCount);
  });

  it('stores UTM parameters when present', async () => {
    await request(app)
      .post('/api/contact')
      .send({
        ...validPayload,
        email: 'utm@example.com',
        utm_source: 'google',
        utm_medium: 'cpc',
        utm_campaign: 'summer2025',
      })
      .expect(201);

    const lead = await prisma.lead.findFirst({ where: { email: 'utm@example.com' } });
    expect(lead!.utmSource).toBe('google');
    expect(lead!.utmMedium).toBe('cpc');
    expect(lead!.utmCampaign).toBe('summer2025');
  });
});
