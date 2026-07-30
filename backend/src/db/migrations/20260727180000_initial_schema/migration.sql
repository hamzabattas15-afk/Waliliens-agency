-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'VIEWER');
CREATE TYPE "ProjectType" AS ENUM ('web_development', 'ai_automation', 'both');
CREATE TYPE "LeadStatus" AS ENUM ('new', 'contacted', 'qualified', 'closed');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL, "email" TEXT NOT NULL, "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VIEWER', "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "leads" (
    "id" TEXT NOT NULL, "name" TEXT NOT NULL, "email" TEXT NOT NULL,
    "projectType" "ProjectType" NOT NULL, "message" TEXT NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'new', "ipHash" TEXT, "userAgent" TEXT,
    "utmSource" TEXT, "utmMedium" TEXT, "utmCampaign" TEXT, "referer" TEXT,
    "confirmationSentAt" TIMESTAMP(3), "teamNotifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "projects" (
    "id" TEXT NOT NULL, "title" TEXT NOT NULL, "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL, "description" TEXT NOT NULL, "imageUrl" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[], "published" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL, "resourceId" TEXT NOT NULL, "before" JSONB, "after" JSONB,
    "ipHash" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_email_idx" ON "users"("email");
CREATE INDEX "leads_email_idx" ON "leads"("email");
CREATE INDEX "leads_status_idx" ON "leads"("status");
CREATE INDEX "leads_projectType_idx" ON "leads"("projectType");
CREATE INDEX "leads_createdAt_idx" ON "leads"("createdAt");
CREATE UNIQUE INDEX "projects_slug_key" ON "projects"("slug");
CREATE INDEX "projects_slug_idx" ON "projects"("slug");
CREATE INDEX "projects_published_sortOrder_idx" ON "projects"("published", "sortOrder");
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");
CREATE INDEX "audit_logs_resourceType_resourceId_idx" ON "audit_logs"("resourceType", "resourceId");
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
