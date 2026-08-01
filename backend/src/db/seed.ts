import { PrismaClient, Role } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(
      `❌ ${name} is required to seed the database (no hardcoded fallback). Set it and retry.`
    );
    process.exit(1);
  }
  return value;
}

async function main() {
  // Seeding hardcoded/dev credentials into a real production database is
  // exactly the kind of thing that should require a deliberate, explicit
  // override — not run silently because someone's .env happened to have
  // NODE_ENV=production.
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PROD_SEED !== 'true') {
    console.error(
      '❌ Refusing to seed a production database. Set ALLOW_PROD_SEED=true to override.'
    );
    process.exit(1);
  }

  console.log('🌱 Seeding database...');

  // ── Admin users ──────────────────────────────────────────────────────────

  const adminPasswordPlain = requireEnv('SEED_ADMIN_PASSWORD');
  const viewerPasswordPlain = requireEnv('SEED_VIEWER_PASSWORD');

  const adminPassword = await argon2.hash(adminPasswordPlain, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const viewerPassword = await argon2.hash(viewerPasswordPlain, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  // `update` intentionally omits passwordHash — re-running the seed against
  // an existing database must not silently reset a real admin's password
  // back to whatever SEED_ADMIN_PASSWORD happens to be set to right now.
  const admin = await prisma.user.upsert({
    where: { email: 'admin@waliliens.com' },
    update: { role: Role.ADMIN },
    create: {
      email: 'admin@waliliens.com',
      name: 'Waliliens Admin',
      passwordHash: adminPassword,
      role: Role.ADMIN,
    },
  });

  const viewer = await prisma.user.upsert({
    where: { email: 'viewer@waliliens.com' },
    update: { role: Role.VIEWER },
    create: {
      email: 'viewer@waliliens.com',
      name: 'Waliliens Viewer',
      passwordHash: viewerPassword,
      role: Role.VIEWER,
    },
  });

  console.log(`✅ Users: admin=${admin.id}, viewer=${viewer.id}`);

  // ── Sample projects (matches placeholder HTML in index.html) ──────────────

  const projects = await Promise.all([
    prisma.project.upsert({
      where: { slug: 'nova-finance' },
      update: {},
      create: {
        title: 'Nova Finance',
        slug: 'nova-finance',
        category: 'Développement web',
        description:
          'Plateforme de marque complète pour Nova Finance — identité visuelle, site web haute performance et système de design cohérent pensé pour inspirer confiance.',
        imageUrl: null,
        tags: ['Branding', 'Web Development', 'Design System'],
        published: true,
        sortOrder: 1,
      },
    }),
    prisma.project.upsert({
      where: { slug: 'motion-studio' },
      update: {},
      create: {
        title: 'Motion Studio',
        slug: 'motion-studio',
        category: 'Direction artistique · Portfolio',
        description:
          "Portfolio créatif pour Motion Studio — une vitrine de direction artistique avec des animations GSAP signature qui reflètent l'identité de la marque.",
        imageUrl: null,
        tags: ['Art Direction', 'Animation', 'Portfolio'],
        published: true,
        sortOrder: 2,
      },
    }),
    prisma.project.upsert({
      where: { slug: 'flow-operations' },
      update: {},
      create: {
        title: 'Flow Operations',
        slug: 'flow-operations',
        category: 'Automatisation par IA · Design produit',
        description:
          "Système d'automatisation intelligent pour Flow Operations — agents IA, workflows automatisés et intégrations CRM pour éliminer les tâches répétitives.",
        imageUrl: null,
        tags: ['AI Automation', 'Product Design', 'Integrations'],
        published: true,
        sortOrder: 3,
      },
    }),
  ]);

  console.log(`✅ Projects seeded: ${projects.map((p) => p.slug).join(', ')}`);

  // ── Sample lead (for testing the admin panel) ────────────────────────────

  await prisma.lead.upsert({
    where: { id: 'seed-lead-001' },
    update: {},
    create: {
      id: 'seed-lead-001',
      name: 'Alice Dupont',
      email: 'alice@example.com',
      projectType: 'web_development',
      message:
        'Bonjour, je cherche une agence pour refondre notre site e-commerce avec un focus sur les performances et le design.',
      status: 'new',
      utmSource: 'google',
      utmMedium: 'cpc',
    },
  });

  console.log('✅ Sample lead created');
  console.log('\n🎉 Seed complete!');
  console.log('   Admin:  admin@waliliens.com (password: SEED_ADMIN_PASSWORD)');
  console.log('   Viewer: viewer@waliliens.com (password: SEED_VIEWER_PASSWORD)');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
