import 'dotenv/config';

// Tests must opt into a dedicated local database; never infer the development target.
const target = process.env.AUDIT_DATABASE_URL;
if (!target) throw new Error('Set AUDIT_DATABASE_URL to a disposable local *_uitest database');
const url = new URL(target);
if (
  !['localhost', '127.0.0.1'].includes(url.hostname) ||
  !url.pathname.endsWith('_uitest') ||
  process.env.NODE_ENV === 'production'
) {
  throw new Error('Audit tests require a local *_uitest database outside production');
}
process.env.DATABASE_URL = target;
process.env.NODE_ENV = 'test';
process.env.RUN_BACKGROUND_WORKER = 'false';
process.env.FILE_STORAGE_PROVIDER = 'local';
process.env.FILE_STORAGE_ROOT = `${process.cwd()}/tmp/audit-storage`;
process.env.REDIS_URL = '';
process.env.CLAMAV_HOST = '';
process.env.FILE_SCAN_REQUIRED = 'false';
process.env.FILE_ENCRYPTION_KEY = Buffer.alloc(32, 17).toString('base64');
process.env.FILE_ACCESS_SECRET = 'audit-only-file-access-secret-20261117';
process.env.INTEGRATION_ENCRYPTION_KEY = 'audit-only-integration-encryption-key-20261117';
process.env.JWT_ACCESS_SECRET = 'audit-only-access-secret-20261117';
process.env.JWT_REFRESH_SECRET = 'audit-only-refresh-secret-20261117';
process.env.WHATSAPP_ACCESS_TOKEN = '';
process.env.SMTP_HOST = '';
process.env.META_ADS_INGEST_SECRET = 'audit-only-meta-ingest-secret';
process.env.WEBSITE_LEAD_INGEST_SECRET = 'audit-only-website-ingest-secret';
process.env.PAYMENT_GATEWAY_SECRET = 'audit-only-payment-gateway-secret';

process.env.PAYMENT_GATEWAY_ENABLED = 'true';
