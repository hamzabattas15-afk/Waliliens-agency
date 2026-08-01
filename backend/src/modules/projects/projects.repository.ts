import { prisma } from '../../db/prisma.js';
import { CreateProjectInput, UpdateProjectInput } from './projects.schema.js';

const PROJECT_SELECT = {
  id: true,
  title: true,
  slug: true,
  category: true,
  description: true,
  imageUrl: true,
  tags: true,
  published: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function findPublishedProjects() {
  return prisma.project.findMany({
    where: { published: true },
    orderBy: { sortOrder: 'asc' },
    select: PROJECT_SELECT,
  });
}

export async function findAllProjects() {
  return prisma.project.findMany({
    orderBy: [{ published: 'desc' }, { sortOrder: 'asc' }],
    select: PROJECT_SELECT,
  });
}

export async function findProjectById(id: string) {
  return prisma.project.findUnique({
    where: { id },
    select: PROJECT_SELECT,
  });
}

export async function createProject(data: CreateProjectInput) {
  return prisma.project.create({
    data: {
      title: data.title,
      slug: data.slug,
      category: data.category,
      description: data.description,
      imageUrl: data.imageUrl ?? null,
      tags: data.tags,
      published: data.published,
      sortOrder: data.sortOrder,
    },
    select: PROJECT_SELECT,
  });
}

export async function updateProject(id: string, data: UpdateProjectInput) {
  return prisma.project.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.slug !== undefined && { slug: data.slug }),
      ...(data.category !== undefined && { category: data.category }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
      ...(data.tags !== undefined && { tags: data.tags }),
      ...(data.published !== undefined && { published: data.published }),
      ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
    },
    select: PROJECT_SELECT,
  });
}

export async function deleteProject(id: string) {
  return prisma.project.delete({
    where: { id },
    select: { id: true, title: true },
  });
}
