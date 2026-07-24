import { z } from 'zod';

export const leadsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  status: z
    .enum(['new', 'contacted', 'qualified', 'closed'])
    .optional(),
  projectType: z
    .enum(['web_development', 'ai_automation', 'both'])
    .optional(),
  dateFrom: z.string().datetime({ offset: true }).optional(),
  dateTo: z.string().datetime({ offset: true }).optional(),
  search: z.string().max(100).optional(),
});

export const updateLeadStatusSchema = z.object({
  status: z.enum(['new', 'contacted', 'qualified', 'closed']),
});

export type LeadsQuery = z.infer<typeof leadsQuerySchema>;
export type UpdateLeadStatus = z.infer<typeof updateLeadStatusSchema>;
