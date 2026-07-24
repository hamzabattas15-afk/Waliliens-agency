import { z } from 'zod';

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const createProjectSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(slugRegex, 'Slug must be lowercase letters, numbers, and hyphens only')
    .trim(),
  category: z.string().min(1).max(100).trim(),
  description: z.string().min(1).max(10000).trim(),
  imageUrl: z.string().url().optional().nullable(),
  tags: z.array(z.string().max(50)).max(10).default([]),
  published: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),
});

export const updateProjectSchema = createProjectSchema.partial();

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
