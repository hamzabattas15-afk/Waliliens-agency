import { Router } from 'express';
import { contactIpRateLimit, contactEmailRateLimit } from '../../middleware/rateLimiter.js';
import { submitContact } from './contact.controller.js';

const router = Router();

/**
 * @openapi
 * /api/contact:
 *   post:
 *     tags: [Contact]
 *     summary: Submit a contact/project inquiry
 *     description: |
 *       Validates the form data, saves the lead to the database,
 *       and enqueues confirmation + team notification emails.
 *       Includes honeypot spam protection and per-IP/per-email rate limiting.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, projectType, message]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *                 example: Alice Dupont
 *               email:
 *                 type: string
 *                 format: email
 *                 example: alice@example.com
 *               projectType:
 *                 type: string
 *                 enum: [web-development, ai-automation, both]
 *                 example: web-development
 *               message:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 5000
 *                 example: Nous cherchons à refondre notre site e-commerce.
 *               _hp:
 *                 type: string
 *                 description: Honeypot field — must be empty. Leave this field out.
 *     responses:
 *       201:
 *         description: Lead created, emails queued
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *       422:
 *         description: Validation error
 *       429:
 *         description: Rate limit exceeded
 */
router.post(
  '/',
  contactIpRateLimit,
  contactEmailRateLimit,
  submitContact
);

export default router;
