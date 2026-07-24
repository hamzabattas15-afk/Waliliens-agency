import { PrismaClient, Role } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ── Admin users ──────────────────────────────────────────────────────────

  const adminPassword = await argon2.hash('Waliliens2025!', {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const viewerPassword = await argon2.hash('Viewer2025!', {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@waliliens.com' },
    update: { passwordHash: adminPassword, role: Role.ADMIN },
    create: {
      email: 'admin@waliliens.com',
      name: 'Waliliens Admin',
      passwordHash: adminPassword,
      role: Role.ADMIN,
    },
  });

  const viewer = await prisma.user.upsert({
    where: { email: 'viewer@waliliens.com' },
    update: { passwordHash: viewerPassword, role: Role.VIEWER },
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
  console.log('   Admin:  admin@waliliens.com / Waliliens2025!');
  console.log('   Viewer: viewer@waliliens.com / Viewer2025!');
  console.log('   ⚠️  Change these passwords before going to production!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
