import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL: z.string().default('7d'),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().positive().default(7),
  REFRESH_TOKEN_COOKIE_NAME: z.string().default('revive_refresh_token'),
  COOKIE_DOMAIN: z.string().optional(),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  FRONTEND_URLS: z.string().optional(),
  FILE_STORAGE_ROOT: z.string().optional(),
  FILE_ACCESS_SECRET: z.string().min(16).optional(),
  GOOGLE_ADS_INGEST_SECRET: z.string().min(24).optional(),
  META_ADS_INGEST_SECRET: z.string().min(24).optional(),
  PAYMENT_GATEWAY_SECRET: z.string().min(16).optional(),
  INTEGRATION_ENCRYPTION_KEY: z.string().min(32).optional(),
  META_GRAPH_API_URL: z.string().url().default('https://graph.facebook.com'),
  META_GRAPH_API_VERSION: z
    .string()
    .regex(/^v\d+\.\d+$/)
    .default('v23.0'),
  WHATSAPP_PHONE_NUMBER_ID: z.string().min(1).optional(),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().min(1).optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().min(1).optional(),
  WHATSAPP_APPOINTMENT_TEMPLATE_NAME: z.string().min(1).default('appointment_confirmation'),
  WHATSAPP_APPOINTMENT_TEMPLATE_LANGUAGE: z.string().min(2).default('en_US'),
  GOOGLE_ADS_API_URL: z.string().url().default('https://googleads.googleapis.com'),
  GOOGLE_ADS_API_VERSION: z
    .string()
    .regex(/^v\d+$/)
    .default('v20'),
  GOOGLE_OAUTH_TOKEN_URL: z.string().url().default('https://oauth2.googleapis.com/token'),
  GOOGLE_OAUTH_AUTH_URL: z.string().url().default('https://accounts.google.com/o/oauth2/v2/auth'),
  BACKEND_PUBLIC_URL: z.string().url().default('http://localhost:4000'),
  INTEGRATION_JOB_POLL_MS: z.coerce.number().int().min(1000).default(10000),
  INTEGRATION_WORKER_ID: z.string().default('revive-integration-worker'),
  PROVIDER_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(20000),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(10000),
  MFA_ISSUER: z.string().default('Revive Clinic CRM'),
});

const parsedEnv = envSchema.parse(process.env);
if (parsedEnv.NODE_ENV === 'production') {
  const placeholderValues = new Set([
    'replace-with-access-secret',
    'replace-with-refresh-secret',
    'replace-with-at-least-32-random-characters',
  ]);
  const requiredSecrets = {
    JWT_ACCESS_SECRET: parsedEnv.JWT_ACCESS_SECRET,
    JWT_REFRESH_SECRET: parsedEnv.JWT_REFRESH_SECRET,
    INTEGRATION_ENCRYPTION_KEY: parsedEnv.INTEGRATION_ENCRYPTION_KEY,
    FILE_ACCESS_SECRET: parsedEnv.FILE_ACCESS_SECRET,
    GOOGLE_ADS_INGEST_SECRET: parsedEnv.GOOGLE_ADS_INGEST_SECRET,
    META_ADS_INGEST_SECRET: parsedEnv.META_ADS_INGEST_SECRET,
  };
  const invalid = Object.entries(requiredSecrets)
    .filter(([, value]) => !value || placeholderValues.has(value))
    .map(([key]) => key);
  if (invalid.length) throw new Error(`Production secrets are missing or unsafe: ${invalid.join(', ')}`);
  if (parsedEnv.JWT_ACCESS_SECRET === parsedEnv.JWT_REFRESH_SECRET) {
    throw new Error('JWT access and refresh secrets must be independent');
  }
}

export const env = {
  ...parsedEnv,
  FRONTEND_ORIGINS: [
    parsedEnv.FRONTEND_URL,
    ...(parsedEnv.FRONTEND_URLS?.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean) ?? []),
    ...(parsedEnv.NODE_ENV === 'development'
      ? ['http://localhost:3001', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001']
      : []),
  ],
};
