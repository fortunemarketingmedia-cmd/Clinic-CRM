import 'dotenv/config';
import crypto from 'node:crypto';
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

if (process.env.CONFIRM_FILE_MIGRATION !== 'I_UNDERSTAND_PATIENT_FILES_WILL_BE_UPLOADED') {
  throw new Error('Set CONFIRM_FILE_MIGRATION=I_UNDERSTAND_PATIENT_FILES_WILL_BE_UPLOADED after approving the destination bucket.');
}

const required = ['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'FILE_ENCRYPTION_KEY'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) throw new Error(`Missing object-storage settings: ${missing.join(', ')}`);

const storageRoot = path.resolve(process.env.FILE_STORAGE_ROOT || 'storage/private');
const prefix = (process.env.S3_KEY_PREFIX || 'revive-crm').replace(/^\/+|\/+$/g, '');
const encryptionKey = Buffer.from(process.env.FILE_ENCRYPTION_KEY || '', 'base64');
if (encryptionKey.length !== 32) throw new Error('FILE_ENCRYPTION_KEY must be a base64-encoded 32-byte key');
const encryptionMagic = Buffer.from('RVCFILE1', 'ascii');
const s3 = new S3Client({
  region: process.env.S3_REGION || 'ap-south-1',
  endpoint: process.env.S3_ENDPOINT || undefined,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
});

const mimeByExtension = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.pdf': 'application/pdf', '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.txt': 'text/plain', '.csv': 'text/csv',
};

function encryptForStorage(buffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
  cipher.setAAD(encryptionMagic);
  const ciphertext = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return Buffer.concat([encryptionMagic, iv, cipher.getAuthTag(), ciphertext]);
}

function serverSideEncryptionOptions() {
  const mode = process.env.S3_SERVER_SIDE_ENCRYPTION || 'none';
  if (mode === 'none') return {};
  if (!['AES256', 'aws:kms'].includes(mode)) throw new Error('Unsupported S3_SERVER_SIDE_ENCRYPTION value');
  if (mode === 'aws:kms' && !process.env.S3_KMS_KEY_ID) throw new Error('S3_KMS_KEY_ID is required for aws:kms');
  return { ServerSideEncryption: mode, ...(mode === 'aws:kms' ? { SSEKMSKeyId: process.env.S3_KMS_KEY_ID } : {}) };
}

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(absolute));
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
}

let uploaded = 0;
let skipped = 0;
for (const absolute of await filesUnder(storageRoot)) {
  const storageKey = path.relative(storageRoot, absolute).split(path.sep).join('/');
  const key = [prefix, storageKey].filter(Boolean).join('/');
  const body = await readFile(absolute);
  const sha256 = crypto.createHash('sha256').update(body).digest('hex');
  let existing;
  try {
    existing = await s3.send(new HeadObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
  } catch (error) {
    if (error?.$metadata?.httpStatusCode !== 404 && error?.name !== 'NotFound') throw error;
  }
  if (existing?.Metadata?.sha256 === sha256 && existing?.Metadata?.encryption === 'aes-256-gcm-v1') {
    skipped += 1;
    continue;
  }
  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: encryptForStorage(body),
    ContentType: 'application/octet-stream',
    ...serverSideEncryptionOptions(),
    Metadata: {
      sha256,
      encryption: 'aes-256-gcm-v1',
      originalcontenttype: mimeByExtension[path.extname(absolute).toLowerCase()] || 'application/octet-stream',
    },
  }));
  uploaded += 1;
}

console.log(JSON.stringify({ status: 'complete', uploaded, skipped, source: storageRoot, bucket: process.env.S3_BUCKET, prefix }));
