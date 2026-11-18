import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createHash, randomUUID } from 'node:crypto';
import { link, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { resolve, dirname, sep } from 'node:path';
import { storedFileIsCompressed, unpackStoredFile } from '../dist/src/utils/stored-file.js';
import { decryptFileBuffer } from '../dist/src/utils/file-encryption.js';

const mode = process.argv[2];
const fromRemote = mode === 'to-local';
const verifyLocal = mode === 'verify-local';
if (!verifyLocal && !fromRemote && mode !== 'to-r2') throw new Error('Choose verify-local, to-local or to-r2');
const copy = process.argv.includes('--copy');
if (copy && process.env.CONFIRM_FILE_MIGRATION !== 'I_UNDERSTAND_PATIENT_FILES_WILL_BE_COPIED') {
  throw new Error('Copying records requires explicit operator approval');
}
const { S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, FILE_STORAGE_ROOT, FILE_ENCRYPTION_KEY } = process.env;
if (!FILE_STORAGE_ROOT || !FILE_ENCRYPTION_KEY || (!verifyLocal && ![S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY].every(Boolean))) {
  throw new Error('Set the private filesystem, encryption key and remote connection parameters');
}
const endpoint = verifyLocal ? null : new URL(S3_ENDPOINT);
if (endpoint && (fromRemote ? !['http:', 'https:'].includes(endpoint.protocol) : endpoint.protocol !== 'https:' || !endpoint.hostname.endsWith('.r2.cloudflarestorage.com'))) {
  throw new Error('Use the approved private source or an HTTPS Cloudflare R2 target');
}
const root = resolve(FILE_STORAGE_ROOT);
const encryptionKey = Buffer.from(FILE_ENCRYPTION_KEY, 'base64');
const prefix = (process.env.S3_KEY_PREFIX || 'revive-crm').replace(/^\/+|\/+$/g, '');
if (encryptionKey.length !== 32 || !prefix) throw new Error('Invalid encryption key or storage prefix');
const client = endpoint && new S3Client({
  endpoint: endpoint.href, region: fromRemote ? process.env.S3_REGION || 'ap-south-1' : 'auto',
  forcePathStyle: true,
  credentials: { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY },
});
const prisma = new PrismaClient();
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const counts = { referenced: 0, verified: 0, copied: 0, missingAtDestination: 0, failed: 0 };

async function remote(key) {
  try {
    const object = await client.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: prefix + '/' + key }));
    if (!object.Body || !object.ContentLength || object.ContentLength > 55 * 1024 * 1024) throw new Error('Invalid object size');
    return Buffer.from(await object.Body.transformToByteArray());
  } catch (error) {
    if (error?.$metadata?.httpStatusCode === 404) return null;
    throw error;
  }
}

try {
  const rows = await prisma.$queryRaw`
    SELECT f."storageKey" AS key, f.checksum, f."sizeBytes",
      (to_jsonb(f)->>'storedSizeBytes')::integer AS "storedSizeBytes"
    FROM "PatientFile" f WHERE f."storageKey" IS NOT NULL
    UNION ALL SELECT "signatureStorageKey", NULL, NULL, NULL FROM "ConsentRecord"
    UNION ALL SELECT "doctorSignatureStorageKey", NULL, NULL, NULL FROM "ConsentRecord" WHERE "doctorSignatureStorageKey" IS NOT NULL
    UNION ALL SELECT "guardianSignatureStorageKey", NULL, NULL, NULL FROM "ConsentRecord" WHERE "guardianSignatureStorageKey" IS NOT NULL
    UNION ALL SELECT "signedPdfStorageKey", NULL, NULL, NULL FROM "ConsentRecord"`;
  const keys = new Map();
  for (const row of rows) if (!row.key.startsWith('legacy/')) keys.set(row.key, row.checksum || !keys.has(row.key) ? row : keys.get(row.key));
  counts.referenced = keys.size;
  for (const [key, { checksum, sizeBytes, storedSizeBytes }] of keys) {
    try {
      if (key.includes('\\') || key.split('/').some((segment) => !segment || segment === '.' || segment === '..')) throw new Error('Invalid key');
      const target = resolve(root, key);
      if (!target.startsWith(root + sep)) throw new Error('Invalid path');
      const local = () => readFile(target).catch((error) => { if (error.code === 'ENOENT') return null; throw error; });
      const source = await (fromRemote ? remote(key) : local());
      if (!source) throw new Error('Source object is missing');
      const contents = decryptFileBuffer(source, encryptionKey);
      const validated = digest(storedFileIsCompressed(sizeBytes, storedSizeBytes, 36) ? unpackStoredFile(contents, 55 * 1024 * 1024) : contents);
      if (checksum && validated !== checksum) throw new Error('Database checksum mismatch');
      if (verifyLocal) { counts.verified++; continue; }
      const destination = fromRemote ? local : () => remote(key);
      const expected = digest(source);
      let existing = await destination();
      if (!existing && copy) {
        if (fromRemote) {
          await mkdir(dirname(target), { recursive: true, mode: 0o700 });
          const temporary = target + '.' + randomUUID() + '.part';
          try {
            await writeFile(temporary, source, { flag: 'wx', mode: 0o600, flush: true });
            await link(temporary, target);
          } finally { await unlink(temporary).catch(() => undefined); }
        } else {
          await client.send(new PutObjectCommand({ Bucket: S3_BUCKET, Key: prefix + '/' + key, Body: source, IfNoneMatch: '*', ContentType: 'application/octet-stream' }));
        }
        counts.copied++;
        existing = await destination();
      }
      if (!existing) counts.missingAtDestination++;
      else if (digest(existing) === expected) counts.verified++;
      else throw new Error('Destination bytes differ');
    } catch { counts.failed++; }
  }
  console.log(JSON.stringify(counts));
  if (counts.failed || counts.missingAtDestination) process.exitCode = 1;
} finally {
  await prisma.$disconnect();
  client?.destroy();
}
