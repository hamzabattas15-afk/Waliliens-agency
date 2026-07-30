import { Request, Response, NextFunction } from 'express';
import { contactSchema } from './contact.schema.js';
import { processContactSubmission } from './contact.service.js';
import { AppError } from '../../middleware/errorHandler.js';

/**
 * POST /api/contact
 *
 * Validates input, runs spam checks, persists the lead,
 * and enqueues email jobs.
 */
export async function submitContact(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Validate and parse body
    const parseResult = contactSchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0];
      throw new AppError(firstError?.message ?? 'Validation failed', 422, 'VALIDATION_ERROR');
    }

    const input = parseResult.data;

    // Honeypot check — silently succeed (return 200 to confuse bots)
    if (input._hp && input._hp.length > 0) {
      res.status(200).json({
        success: true,
        message: 'Votre demande a été reçue.',
      });
      return;
    }

    // Optional: Cloudflare Turnstile verification
    const turnstileToken = req.headers['cf-turnstile-response'] as string | undefined;
    if (process.env.TURNSTILE_SECRET_KEY) {
      if (!turnstileToken) {
        throw new AppError('Vérification CAPTCHA requise', 400, 'CAPTCHA_REQUIRED');
      }
      const { verifyTurnstile } = await import('./contact.service.js');
      const ip = req.ip ?? '0.0.0.0';
      const valid = await verifyTurnstile(turnstileToken, ip);
      if (!valid) {
        throw new AppError('Vérification CAPTCHA échouée', 400, 'CAPTCHA_FAILED');
      }
    }

    // Process submission
    const result = await processContactSubmission(input, req);

    res.status(201).json({
      success: true,
      message: 'Votre demande a été reçue. Nous vous répondrons sous deux jours ouvrés.',
      data: { id: result.id },
    });
  } catch (err) {
    next(err);
  }
}
