import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { listLeads, getLead, patchLeadStatus } from './leads.controller.js';

const router = Router();

// All leads routes require authentication
router.use(requireAuth);

/**
 * @openapi
 * /api/admin/leads:
 *   get:
 *     tags: [Admin - Leads]
 *     summary: List all leads (paginated, filterable)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [new, contacted, qualified, closed] }
 *       - in: query
 *         name: projectType
 *         schema: { type: string, enum: [web_development, ai_automation, both] }
 *       - in: query
 *         name: dateFrom
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: dateTo
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Paginated list of leads
 *       401:
 *         description: Unauthorized
 */
router.get('/', requireRole('ADMIN', 'VIEWER'), listLeads);

/**
 * @openapi
 * /api/admin/leads/{id}:
 *   get:
 *     tags: [Admin - Leads]
 *     summary: Get a single lead by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Lead details
 *       404:
 *         description: Lead not found
 */
router.get('/:id', requireRole('ADMIN', 'VIEWER'), getLead);

/**
 * @openapi
 * /api/admin/leads/{id}:
 *   patch:
 *     tags: [Admin - Leads]
 *     summary: Update lead status
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [new, contacted, qualified, closed]
 *     responses:
 *       200:
 *         description: Status updated (audit log written)
 *       403:
 *         description: Requires ADMIN role
 *       404:
 *         description: Lead not found
 */
router.patch('/:id', requireRole('ADMIN'), patchLeadStatus);

export default router;
