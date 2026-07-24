import { Request, Response, NextFunction } from 'express';
import { createProjectSchema, updateProjectSchema } from './projects.schema.js';
import {
  findAllProjects,
  findProjectById,
  createProject,
  updateProject,
  deleteProject,
} from './projects.repository.js';
import { getPublishedProjects, invalidateProjectsCache } from './projects.service.js';
import { writeAuditLog } from '../../middleware/audit.js';
import { AppError } from '../../middleware/errorHandler.js';

/**
 * GET /api/projects — public, cached
 */
export async function listPublicProjects(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const projects = await getPublishedProjects();
    res.status(200).json({ success: true, data: projects });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admin/projects — all (admin)
 */
export async function listAllProjects(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const projects = await findAllProjects();
    res.status(200).json({ success: true, data: projects });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/admin/projects
 */
export async function createProjectHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parseResult = createProjectSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new AppError(
        parseResult.error.issues[0]?.message ?? 'Validation failed',
        422,
        'VALIDATION_ERROR'
      );
    }

    const project = await createProject(parseResult.data);
    await invalidateProjectsCache();

    await writeAuditLog(req, req.user!.id, {
      action: 'project.created',
      resourceType: 'Project',
      resourceId: project.id,
      after: { title: project.title, slug: project.slug },
    });

    res.status(201).json({ success: true, data: project });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/admin/projects/:id
 */
export async function updateProjectHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = String(req.params.id);
    const parseResult = updateProjectSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new AppError(
        parseResult.error.issues[0]?.message ?? 'Validation failed',
        422,
        'VALIDATION_ERROR'
      );
    }

    const existing = await findProjectById(id);
    if (!existing) {
      throw new AppError('Project not found', 404, 'NOT_FOUND');
    }

    const project = await updateProject(id, parseResult.data);
    await invalidateProjectsCache();

    await writeAuditLog(req, req.user!.id, {
      action: 'project.updated',
      resourceType: 'Project',
      resourceId: project.id,
      before: { title: existing.title, published: existing.published },
      after: { title: project.title, published: project.published },
    });

    res.status(200).json({ success: true, data: project });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/admin/projects/:id
 */
export async function deleteProjectHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = String(req.params.id);
    const existing = await findProjectById(id);
    if (!existing) {
      throw new AppError('Project not found', 404, 'NOT_FOUND');
    }

    const deleted = await deleteProject(id);
    await invalidateProjectsCache();

    await writeAuditLog(req, req.user!.id, {
      action: 'project.deleted',
      resourceType: 'Project',
      resourceId: deleted.id,
      before: { title: deleted.title },
    });

    res.status(200).json({ success: true, message: `Project "${deleted.title}" deleted` });
  } catch (err) {
    next(err);
  }
}
