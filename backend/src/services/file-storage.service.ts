import crypto from 'node:crypto';
import { malwareScannerService } from './malware-scanner.service.js';
import { DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { link, mkdir, mkdtemp, open, readFile, rm, stat, statfs, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable, Transform } from 'node:stream';
import { createGunzip } from 'node:zlib';
import { inflateSync } from 'node:zlib';
import { env } from '../config/env.js';
import { compressedHeaderBytes, packStoredFile, storedFileIsCompressed, unpackStoredFile } from '../utils/stored-file.js';
import { HttpError } from '../utils/http-error.js';
import { decryptFileBuffer, encryptFileBuffer, isEncryptedFileBuffer } from '../utils/file-encryption.js';

const storageRoot = path.resolve(env.FILE_STORAGE_ROOT ?? path.join(process.cwd(), 'storage', 'private'));
const accessSecret = env.FILE_ACCESS_SECRET ?? env.JWT_ACCESS_SECRET;
const storageProvider = env.FILE_STORAGE_PROVIDER;
const storagePrefix = env.S3_KEY_PREFIX.replace(/^\/+|\/+$/g, '');
const encryptionKey = env.FILE_ENCRYPTION_KEY ? Buffer.from(env.FILE_ENCRYPTION_KEY, 'base64') : null;
const s3 = storageProvider === 's3' ? new S3Client({
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT,
  forcePathStyle: env.S3_FORCE_PATH_STYLE === 'true',
  credentials: env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY ? {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  } : undefined,
}) : null;
const maxFileBytes = env.MAX_UPLOAD_BYTES;
export const allowedFileMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain', 'text/csv']);

function extensionFor(mimeType: string) {
  return ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif', 'application/pdf': 'pdf', 'application/msword': 'doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx', 'application/vnd.ms-excel': 'xls', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx', 'text/plain': 'txt', 'text/csv': 'csv' } as Record<string, string>)[mimeType] ?? 'bin';
}

function resolveStorageKey(storageKey: string) {
  const resolved = path.resolve(storageRoot, storageKey);
  if (!resolved.startsWith(`${storageRoot}${path.sep}`)) throw new HttpError(400, 'Invalid storage key');
  return resolved;
}

function objectKey(storageKey: string) {
  if (storageKey.startsWith('/') || storageKey.includes('..') || storageKey.includes('\\')) throw new HttpError(400, 'Invalid storage key');
  return [storagePrefix, storageKey].filter(Boolean).join('/');
}

function encryptForStorage(buffer: Buffer) {
  if (!encryptionKey) return buffer;
  return encryptFileBuffer(buffer, encryptionKey);
}

const maxStoredPlaintextBytes = 52_428_800;
const encryptionOverhead = 36;

function decryptFromStorage(buffer: Buffer, compressed: boolean) {
  if (!encryptionKey) return compressed ? unpackStoredFile(buffer, maxStoredPlaintextBytes) : buffer;
  if (!isEncryptedFileBuffer(buffer)) {
    throw new HttpError(409, 'Stored file is not encrypted with the active key; complete the controlled file migration');
  }
  try {
    const contents = decryptFileBuffer(buffer, encryptionKey);
    return compressed ? unpackStoredFile(contents, maxStoredPlaintextBytes) : contents;
  } catch {
    throw new HttpError(409, 'Stored file failed its encryption integrity check');
  }
}

function serverSideEncryptionOptions() {
  if (env.S3_SERVER_SIDE_ENCRYPTION === 'none') return {};
  return {
    ServerSideEncryption: env.S3_SERVER_SIDE_ENCRYPTION,
    ...(env.S3_SERVER_SIDE_ENCRYPTION === 'aws:kms' ? { SSEKMSKeyId: env.S3_KMS_KEY_ID } : {}),
  };
}

async function writeStoredFile(storageKey: string, buffer: Buffer, mimeType: string) {
  const encryptedBuffer = encryptForStorage(packStoredFile(buffer, mimeType));
  if (storageProvider === 's3') {
    if (!s3 || !env.S3_BUCKET) throw new Error('S3-compatible storage is not configured');
    await s3.send(new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: objectKey(storageKey),
      Body: encryptedBuffer,
      ContentType: 'application/octet-stream',
      ...serverSideEncryptionOptions(),
      Metadata: {
        sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
        encryption: encryptionKey ? 'aes-256-gcm-v1' : 'none',
        originalcontenttype: mimeType,
      },
    }));
    return encryptedBuffer.length;
  }
  const target = resolveStorageKey(storageKey);
  await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  const available = await statfs(storageRoot);
  if (available.bavail * available.bsize < env.MIN_STORAGE_FREE_BYTES + encryptedBuffer.length) {
    throw new HttpError(507, 'Private file storage is low on space');
  }
  const temporary = target + '.part';
  try {
    await writeFile(temporary, encryptedBuffer, { flag: 'wx', mode: 0o600, flush: true });
    await link(temporary, target);
  } finally { await unlink(temporary).catch(() => undefined); }
  return encryptedBuffer.length;
}

async function readStoredFile(storageKey: string, compressed = false) {
  if (storageProvider === 's3') {
    if (!s3 || !env.S3_BUCKET) throw new Error('S3-compatible storage is not configured');
    const response = await s3.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: objectKey(storageKey) }));
    if (!response.Body) throw new HttpError(404, 'Stored file content was not found');
    return decryptFromStorage(Buffer.from(await response.Body.transformToByteArray()), compressed);
  }
  return decryptFromStorage(await readFile(resolveStorageKey(storageKey)), compressed);
}

function decodeBase64(contentBase64: string, mimeType: string) {
  const encoded = contentBase64.includes(',') ? contentBase64.slice(contentBase64.indexOf(',') + 1) : contentBase64;
  const buffer = Buffer.from(encoded, 'base64');
  if (!buffer.length) throw new HttpError(400, 'File content is empty');
  if (buffer.length > maxFileBytes) throw new HttpError(413, 'File must be 10 MB or smaller');
  if (!allowedFileMimeTypes.has(mimeType)) throw new HttpError(400, 'Unsupported document type');
  validateFileContent(buffer, mimeType);
  return buffer;
}

function validateFileContent(buffer: Buffer, mimeType: string) {
  if (mimeType === 'image/jpeg' && !(buffer.length > 4 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer.at(-2) === 0xff && buffer.at(-1) === 0xd9)) throw new HttpError(400, 'JPEG content is invalid');
  if (mimeType === 'image/webp' && !(buffer.length > 12 && buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP')) throw new HttpError(400, 'WebP content is invalid');
  if (['image/heic', 'image/heif'].includes(mimeType) && !buffer.subarray(4, 12).toString('ascii').includes('ftyp')) throw new HttpError(400, 'HEIF content is invalid');
  if (mimeType === 'application/pdf' && buffer.subarray(0, 5).toString() !== '%PDF-') throw new HttpError(400, 'PDF content is invalid');
  if (['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'].includes(mimeType) && buffer.subarray(0, 2).toString() !== 'PK') throw new HttpError(400, 'Office document content is invalid');
  if (['application/msword', 'application/vnd.ms-excel'].includes(mimeType) && !buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))) throw new HttpError(400, 'Office document content is invalid');
  if (mimeType !== 'image/png') return;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (buffer.length < 33 || !buffer.subarray(0, 8).equals(signature)) throw new HttpError(400, 'PNG content is invalid');
  const compressed: Buffer[] = []; let offset = 8; let hasHeader = false; let hasEnd = false;
  try {
    while (offset + 12 <= buffer.length) {
      const length = buffer.readUInt32BE(offset); const type = buffer.subarray(offset + 4, offset + 8).toString('ascii'); const end = offset + 12 + length;
      if (end > buffer.length) throw new Error('truncated PNG chunk');
      if (type === 'IHDR') hasHeader = length === 13;
      if (type === 'IDAT') compressed.push(buffer.subarray(offset + 8, offset + 8 + length));
      if (type === 'IEND') { hasEnd = true; break; }
      offset = end;
    }
    if (!hasHeader || !hasEnd || !compressed.length) throw new Error('missing PNG chunks');
    inflateSync(Buffer.concat(compressed), { maxOutputLength: 50 * 1024 * 1024 });
  } catch {
    throw new HttpError(400, 'PNG content is invalid');
  }
}

export const fileStorageService = {
  async healthCheck() {
    if (storageProvider === 's3') {
      if (!s3 || !env.S3_BUCKET) throw new Error('S3-compatible storage is not configured');
      await s3.send(new ListObjectsV2Command({ Bucket: env.S3_BUCKET, Prefix: storagePrefix ? `${storagePrefix}/` : undefined, MaxKeys: 1 }));
      return { provider: 's3' as const };
    }
    await mkdir(storageRoot, { recursive: true, mode: 0o700 });
    const probe = path.join(storageRoot, `.health-${crypto.randomUUID()}.part`);
    await writeFile(probe, '', { flag: 'wx', mode: 0o600 });
    await unlink(probe);
    return { provider: 'local' as const };
  },
  async writeBase64(patientId: string, contentBase64: string, mimeType: string) {
    const buffer = decodeBase64(contentBase64, mimeType);
    await malwareScannerService.scan(buffer);
    return this.writeBuffer(patientId, buffer, mimeType);
  },
  async writeBuffer(patientId: string, buffer: Buffer, mimeType: string) {
    if (buffer.length > maxFileBytes) throw new HttpError(413, 'File must be 10 MB or smaller');
    if (!allowedFileMimeTypes.has(mimeType)) throw new HttpError(400, 'Unsupported file type');
    validateFileContent(buffer, mimeType);
    const storageKey = path.posix.join(patientId, `${crypto.randomUUID()}.${extensionFor(mimeType)}`);
    const storedSizeBytes = await writeStoredFile(storageKey, buffer, mimeType);
    return { storageKey, sizeBytes: buffer.length, storedSizeBytes, checksum: crypto.createHash('sha256').update(buffer).digest('hex') };
  },
  read(storageKey: string) { return readStoredFile(storageKey); },
  async openRead(storageKey: string, originalBytes: number | null, storedBytes: number | null) {
    const compressed = storedFileIsCompressed(originalBytes, storedBytes, encryptionKey ? encryptionOverhead : 0);
    if (storageProvider !== 'local' || !encryptionKey) {
      return { stream: Readable.from(await readStoredFile(storageKey, compressed)), cleanup: async () => undefined };
    }
    const target = resolveStorageKey(storageKey);
    const info = await stat(target);
    if (info.size > maxStoredPlaintextBytes + encryptionOverhead || info.size <= encryptionOverhead) throw new HttpError(409, 'Stored file size is invalid');
    const header = Buffer.alloc(encryptionOverhead);
    const handle = await open(target, 'r');
    try { await handle.read(header, 0, encryptionOverhead, 0); } finally { await handle.close(); }
    if (!isEncryptedFileBuffer(header)) throw new HttpError(409, 'Stored file encryption is invalid');
    const temporary = await mkdtemp(path.join(os.tmpdir(), 'revive-download-'));
    const cleanup = () => rm(temporary, { recursive: true, force: true });
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, header.subarray(8, 20));
      decipher.setAAD(header.subarray(0, 8));
      decipher.setAuthTag(header.subarray(20, 36));
      const packed = path.join(temporary, 'verified');
      await pipeline(createReadStream(target, { start: encryptionOverhead }), decipher, createWriteStream(packed, { mode: 0o600, flags: 'wx' }));
      // Authenticate the complete ciphertext before returning any clinical bytes.
      let plaintext = packed;
      if (compressed) {
        plaintext = path.join(temporary, 'content');
        let decoded = 0;
        const limit = new Transform({ transform(chunk: Buffer, _encoding, done) {
          decoded += chunk.length;
          done(decoded > maxStoredPlaintextBytes ? new Error('Decompressed file exceeds size limit') : null, chunk);
        } });
        await pipeline(createReadStream(packed, { start: compressedHeaderBytes }), createGunzip(), limit, createWriteStream(plaintext, { mode: 0o600, flags: 'wx' }));
      }
      return { stream: createReadStream(plaintext), cleanup };
    } catch {
      await cleanup();
      throw new HttpError(409, 'Stored file failed its encryption integrity check');
    }
  },
  async delete(storageKey: string) {
    if (storageProvider === 's3') {
      if (!s3 || !env.S3_BUCKET) throw new Error('S3-compatible storage is not configured');
      await s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: objectKey(storageKey) }));
      return;
    }
    await unlink(resolveStorageKey(storageKey)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
  },
  decodeLegacyDataUrl(url: string) {
    const match = /^data:([^;,]+);base64,(.+)$/s.exec(url);
    if (!match) throw new HttpError(409, 'Legacy external file requires a controlled storage migration before it can be opened');
    return { mimeType: match[1], buffer: Buffer.from(match[2], 'base64') };
  },
  createAccessToken(fileId: string, expiresAt: number) {
    const payload = `${fileId}.${expiresAt}`;
    const signature = crypto.createHmac('sha256', accessSecret).update(payload).digest('base64url');
    return `${expiresAt}.${signature}`;
  },
  verifyAccessToken(fileId: string, token: string) {
    const [expiresText, signature] = token.split('.'); const expiresAt = Number(expiresText);
    if (!expiresAt || expiresAt < Date.now() || !signature) return false;
    const expected = crypto.createHmac('sha256', accessSecret).update(`${fileId}.${expiresAt}`).digest('base64url');
    return signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  },
};
