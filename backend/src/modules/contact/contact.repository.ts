import { prisma } from '../../db/prisma.js';
import { ProjectType } from '@prisma/client';

export interface CreateLeadData {
  name: string;
  email: string;
  projectType: ProjectType;
  message: string;
  ipHash?: string;
  userAgent?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  referer?: string;
}

export async function createLead(data: CreateLeadData) {
  return prisma.lead.create({
    data: {
      name: data.name,
      email: data.email,
      projectType: data.projectType,
      message: data.message,
      status: 'new',
      ipHash: data.ipHash,
      userAgent: data.userAgent,
      utmSource: data.utmSource,
      utmMedium: data.utmMedium,
      utmCampaign: data.utmCampaign,
      referer: data.referer,
    },
    select: {
      id: true,
      name: true,
      email: true,
      projectType: true,
      status: true,
      createdAt: true,
    },
  });
}
