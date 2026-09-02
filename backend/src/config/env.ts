import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(4000),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(2).default(0),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL: z.string().default('7d'),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().positive().default(7),
  REFRESH_TOKEN_COOKIE_NAME: z.string().default('revive_refresh_token'),
  COOKIE_DOMAIN: optional(z.string()),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  FRONTEND_URLS: optional(z.string()),
  FILE_STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
  FILE_STORAGE_ROOT: optional(z.string()),
  S3_ENDPOINT: optional(z.string().url()),
  S3_REGION: z.string().min(1).default('ap-south-1'),
  S3_BUCKET: optional(z.string().min(3)),
  S3_ACCESS_KEY_ID: optional(z.string().min(1)),
  S3_SECRET_ACCESS_KEY: optional(z.string().min(1)),
  S3_FORCE_PATH_STYLE: z.enum(['true', 'false']).default('false'),
  S3_KEY_PREFIX: z.string().default('revive-crm'),
  S3_SERVER_SIDE_ENCRYPTION: z.enum(['none', 'AES256', 'aws:kms']).default('none'),
  S3_KMS_KEY_ID: optional(z.string().min(1)),
  FILE_ENCRYPTION_KEY: optional(z.string().min(43)),
  FILE_ACCESS_SECRET: optional(z.string().min(16)),
  GOOGLE_ADS_INGEST_SECRET: optional(z.string().min(24)),
  META_ADS_INGEST_SECRET: optional(z.string().min(24)),
  PAYMENT_GATEWAY_SECRET: optional(z.string().min(16)),
  INTEGRATION_ENCRYPTION_KEY: optional(z.string().min(32)),
  META_GRAPH_API_URL: z.string().url().default('https://graph.facebook.com'),
  META_GRAPH_API_VERSION: z
    .string()
    .regex(/^v\d+\.\d+$/)
    .default('v23.0'),
  WHATSAPP_PHONE_NUMBER_ID: optional(z.string().min(1)),
  WHATSAPP_BUSINESS_ACCOUNT_ID: optional(z.string().min(1)),
  WHATSAPP_ACCESS_TOKEN: optional(z.string().min(1)),
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
  const unsafeValue = (value?: string) => !value || /replace-with|generate-|example|strong-password/i.test(value);
  const requiredSecrets = {
    JWT_ACCESS_SECRET: parsedEnv.JWT_ACCESS_SECRET,
    JWT_REFRESH_SECRET: parsedEnv.JWT_REFRESH_SECRET,
    INTEGRATION_ENCRYPTION_KEY: parsedEnv.INTEGRATION_ENCRYPTION_KEY,
    FILE_ACCESS_SECRET: parsedEnv.FILE_ACCESS_SECRET,
    GOOGLE_ADS_INGEST_SECRET: parsedEnv.GOOGLE_ADS_INGEST_SECRET,
    META_ADS_INGEST_SECRET: parsedEnv.META_ADS_INGEST_SECRET,
  };
  const invalid = Object.entries(requiredSecrets)
    .filter(([key, value]) => unsafeValue(value) || value!.length < (key === 'INTEGRATION_ENCRYPTION_KEY' ? 32 : 48))
    .map(([key]) => key);
  if (invalid.length) throw new Error(`Production secrets are missing or unsafe: ${invalid.join(', ')}`);
  if (new Set(Object.values(requiredSecrets)).size !== Object.values(requiredSecrets).length) {
    throw new Error('Every production signing, ingest, and integration secret must be independent');
  }
  if (parsedEnv.JWT_ACCESS_SECRET === parsedEnv.JWT_REFRESH_SECRET) {
    throw new Error('JWT access and refresh secrets must be independent');
  }
  let fileEncryptionKey: Buffer | undefined;
  try {
    fileEncryptionKey = parsedEnv.FILE_ENCRYPTION_KEY
      ? Buffer.from(parsedEnv.FILE_ENCRYPTION_KEY, 'base64')
      : undefined;
  } catch {
    fileEncryptionKey = undefined;
  }
  if (
    !fileEncryptionKey ||
    fileEncryptionKey.length !== 32 ||
    !/^[A-Za-z0-9+/]{43}=$/.test(parsedEnv.FILE_ENCRYPTION_KEY ?? '') ||
    unsafeValue(parsedEnv.FILE_ENCRYPTION_KEY) ||
    Object.values(requiredSecrets).includes(parsedEnv.FILE_ENCRYPTION_KEY)
  ) {
    throw new Error('FILE_ENCRYPTION_KEY must be an independent base64-encoded 32-byte production key');
  }
  if (parsedEnv.FILE_STORAGE_PROVIDER !== 's3') {
    throw new Error('Production file storage must use the private S3-compatible provider');
  }
  if (parsedEnv.TRUST_PROXY_HOPS < 1) {
    throw new Error('TRUST_PROXY_HOPS must be at least 1 behind the production reverse proxy');
  }
  const databaseHost = new URL(parsedEnv.DATABASE_URL).hostname;
  if (['localhost', '127.0.0.1', '::1'].includes(databaseHost)) {
    throw new Error('Production DATABASE_URL must not point to a local development database');
  }
  const missingStorage = ['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'].filter(
    (key) => !parsedEnv[key as keyof typeof parsedEnv],
  );
  if (missingStorage.length) {
    throw new Error(`Production object-storage settings are missing: ${missingStorage.join(', ')}`);
  }
  if ([parsedEnv.S3_BUCKET, parsedEnv.S3_ACCESS_KEY_ID, parsedEnv.S3_SECRET_ACCESS_KEY].some(unsafeValue)) {
    throw new Error('Production object-storage settings still contain placeholder values');
  }
  if (parsedEnv.S3_SERVER_SIDE_ENCRYPTION === 'aws:kms' && !parsedEnv.S3_KMS_KEY_ID) {
    throw new Error('S3_KMS_KEY_ID is required when S3 server-side encryption uses aws:kms');
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
