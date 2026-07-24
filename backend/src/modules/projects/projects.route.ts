import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import {
  listPublicProjects,
  listAllProjects,
  createProjectHandler,
  updateProjectHandler,
  deleteProjectHandler,
} from './projects.controller.js';

// ─── Public router (/api/projects) ───────────────────────────────────────────
export const publicProjectsRouter = Router();

/**
 * @openapi
 * /api/projects:
 *   get:
 *     tags: [Projects]
 *     summary: List all published projects (public, Redis-cached 5min)
 *     responses:
 *       200:
 *         description: List of published projects
 */
publicProjectsRouter.get('/', listPublicProjects);

// ─── Admin router (/api/admin/projects) ──────────────────────────────────────
export const adminProjectsRouter = Router();

adminProjectsRouter.use(requireAuth, requireRole('ADMIN'));

/**
 * @openapi
 * /api/admin/projects:
 *   get:
 *     tags: [Admin - Projects]
 *     summary: List all projects including unpublished (admin)
 *     security:
 *       - bearerAuth: []
 */
adminProjectsRouter.get('/', listAllProjects);

/**
 * @openapi
 * /api/admin/projects:
 *   post:
 *     tags: [Admin - Projects]
 *     summary: Create a new project
 *     security:
 *       - bearerAuth: []
 */
adminProjectsRouter.post('/', createProjectHandler);

/**
 * @openapi
 * /api/admin/projects/{id}:
 *   put:
 *     tags: [Admin - Projects]
 *     summary: Update a project (full or partial)
 *     security:
 *       - bearerAuth: []
 */
adminProjectsRouter.put('/:id', updateProjectHandler);

/**
 * @openapi
 * /api/admin/projects/{id}:
 *   delete:
 *     tags: [Admin - Projects]
 *     summary: Delete a project
 *     security:
 *       - bearerAuth: []
 */
adminProjectsRouter.delete('/:id', deleteProjectHandler);
