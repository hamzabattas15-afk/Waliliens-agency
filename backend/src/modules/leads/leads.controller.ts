import { Request, Response, NextFunction } from 'express';
import { leadsQuerySchema, updateLeadStatusSchema } from './leads.schema.js';
import {
  findLeads,
  findLeadById,
  updateLeadStatus,
} from './leads.repository.js';
import { writeAuditLog } from '../../middleware/audit.js';
import { AppError } from '../../middleware/errorHandler.js';
import { LeadStatus } from '@prisma/client';

/**
 * GET /api/admin/leads
 */
export async function listLeads(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parseResult = leadsQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      throw new AppError('Invalid query parameters', 422, 'VALIDATION_ERROR');
    }

    const result = await findLeads(parseResult.data);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admin/leads/:id
 */
export async function getLead(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = String(req.params.id);
    const lead = await findLeadById(id);
    if (!lead) {
      throw new AppError('Lead not found', 404, 'NOT_FOUND');
    }
    res.status(200).json({ success: true, data: lead });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/admin/leads/:id
 */
export async function patchLeadStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = String(req.params.id);
    const parseResult = updateLeadStatusSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new AppError(
        parseResult.error.issues[0]?.message ?? 'Validation failed',
        422,
        'VALIDATION_ERROR'
      );
    }

    const existing = await findLeadById(id);
    if (!existing) {
      throw new AppError('Lead not found', 404, 'NOT_FOUND');
    }

    const updated = await updateLeadStatus(
      id,
      parseResult.data.status as LeadStatus
    );

    // Write audit log
    await writeAuditLog(req, req.user!.id, {
      action: 'lead.status_updated',
      resourceType: 'Lead',
      resourceId: id,
      before: { status: existing.status },
      after: { status: parseResult.data.status },
    });

    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}
