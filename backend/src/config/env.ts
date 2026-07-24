import { z } from 'zod';

const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),

  // Database
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Resend (email)
  RESEND_API_KEY: z.string().startsWith('re_'),
  EMAIL_FROM: z.string().email().default('noreply@waliliens.com'),
  EMAIL_TO_TEAM: z.string().email(),

  // CORS
  ALLOWED_ORIGINS: z.string().default('http://localhost:5500,http://localhost:3000'),

  // Optional: Slack webhook (notifications)
  SLACK_WEBHOOK_URL: z.string().url().optional(),

  // Optional: Cloudflare Turnstile (spam protection)
  TURNSTILE_SECRET_KEY: z.string().optional(),

  // Optional: Sentry (error tracking)
  SENTRY_DSN: z.string().url().optional(),

  // Rate limiting
  RATE_LIMIT_CONTACT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000), // 15 min
  RATE_LIMIT_CONTACT_MAX: z.coerce.number().default(5),
  RATE_LIMIT_EMAIL_WINDOW_MS: z.coerce.number().default(60 * 60 * 1000), // 1 hr
  RATE_LIMIT_EMAIL_MAX: z.coerce.number().default(3),
  RATE_LIMIT_AUTH_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000), // 15 min
  RATE_LIMIT_AUTH_MAX: z.coerce.number().default(10),
});

export type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    result.error.issues.forEach((issue) => {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    });
    process.exit(1);
  }
  return result.data;
}

export const env = parseEnv();
