import { Prisma, LeadStatus, ProjectType } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { LeadsQuery } from './leads.schema.js';

export async function findLeads(query: LeadsQuery) {
  const { page, limit, status, projectType, dateFrom, dateTo, search } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.LeadWhereInput = {
    ...(status && { status: status as LeadStatus }),
    ...(projectType && { projectType: projectType as ProjectType }),
    ...(dateFrom || dateTo
      ? {
          createdAt: {
            ...(dateFrom && { gte: new Date(dateFrom) }),
            ...(dateTo && { lte: new Date(dateTo) }),
          },
        }
      : {}),
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const [leads, total] = await prisma.$transaction([
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        projectType: true,
        message: true,
        status: true,
        utmSource: true,
        utmMedium: true,
        utmCampaign: true,
        confirmationSentAt: true,
        teamNotifiedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.lead.count({ where }),
  ]);

  return {
    leads,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  };
}

export async function findLeadById(id: string) {
  return prisma.lead.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      projectType: true,
      message: true,
      status: true,
      userAgent: true,
      utmSource: true,
      utmMedium: true,
      utmCampaign: true,
      referer: true,
      confirmationSentAt: true,
      teamNotifiedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function updateLeadStatus(id: string, status: LeadStatus) {
  return prisma.lead.update({
    where: { id },
    data: { status },
    select: {
      id: true,
      status: true,
      updatedAt: true,
    },
  });
}
