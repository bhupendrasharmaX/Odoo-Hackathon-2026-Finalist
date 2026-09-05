import 'dotenv/config';
import { z } from 'zod';

/**
 * Environment is parsed once, at boot, and fails loudly. A missing JWT_SECRET
 * in production should stop the process - not surface three hours later as a
 * login that silently accepts forged tokens.
 */

const DEV_JWT_SECRET = 'dev-only-insecure-secret-change-me';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z.string().min(1).optional(),

  JWT_SECRET: z.string().min(1).optional(),
  JWT_EXPIRES_IN: z.string().default('24h'),

  /** Comma-separated list of allowed origins for CORS. */
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  /** SMTP is optional by design - payslip sending falls back to logging. */
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('PeoplePay360 <no-reply@peoplepay.com>'),

  COMPANY_NAME: z.string().default('PeoplePay360'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  // eslint-disable-next-line no-console
  console.error(`Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

const raw = parsed.data;
const isProduction = raw.NODE_ENV === 'production';

if (isProduction && !raw.JWT_SECRET) {
  // eslint-disable-next-line no-console
  console.error('JWT_SECRET must be set when NODE_ENV=production.');
  process.exit(1);
}

if (!raw.JWT_SECRET) {
  // eslint-disable-next-line no-console
  console.warn('[env] JWT_SECRET is not set - falling back to an insecure development secret.');
}

export const env = {
  ...raw,
  JWT_SECRET: raw.JWT_SECRET ?? DEV_JWT_SECRET,
  isProduction,
  isDevelopment: raw.NODE_ENV === 'development',
  isTest: raw.NODE_ENV === 'test',
  corsOrigins: raw.CORS_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  smtpConfigured: Boolean(raw.SMTP_HOST && raw.SMTP_PORT),
};

export type Env = typeof env;
