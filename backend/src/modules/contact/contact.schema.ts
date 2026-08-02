import { z } from 'zod';

export const projectTypeEnum = z.enum([
  'web-development',
  'ai-automation',
  'both',
]);

// Map frontend values to DB enum values
export const projectTypeToDb = {
  'web-development': 'web_development',
  'ai-automation': 'ai_automation',
  'both': 'both',
} as const;

export const contactSchema = z.object({
  name: z
    .string()
    .min(2, 'Le nom doit contenir au moins 2 caractères')
    .max(100, 'Le nom est trop long')
    .trim(),
  email: z
    .string()
    .email('Adresse email invalide')
    .max(255)
    .toLowerCase()
    .trim(),
  projectType: projectTypeEnum,
  message: z
    .string()
    .min(10, 'Le message doit contenir au moins 10 caractères')
    .max(5000, 'Le message est trop long (max 5000 caractères)')
    .trim(),
  // Honeypot field — bots fill it, humans don't see it.
  _hp: z.string().optional().default(''),

  // Required consent checkbox (frontend/contact.html sends value="true" when
  // checked; the field is absent from the request entirely when unchecked,
  // which also fails this — a direct API call can't skip consent just
  // because the browser-side `required` attribute was bypassed).
  consent: z.literal('true', {
    errorMap: () => ({
      message: 'Vous devez accepter la politique de confidentialité pour envoyer ce formulaire',
    }),
  }),

  // Optional UTM tracking params
  utm_source: z.string().max(100).optional(),
  utm_medium: z.string().max(100).optional(),
  utm_campaign: z.string().max(100).optional(),
});

export type ContactInput = z.infer<typeof contactSchema>;
