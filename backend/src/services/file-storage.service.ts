import crypto from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { inflateSync } from 'node:zlib';
import { env } from '../config/env.js';
import { HttpError } from '../utils/http-error.js';

const storageRoot = path.resolve(env.FILE_STORAGE_ROOT ?? path.join(process.cwd(), 'storage', 'private'));
const accessSecret = env.FILE_ACCESS_SECRET ?? env.JWT_ACCESS_SECRET;
const maxFileBytes = 10 * 1024 * 1024;
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain', 'text/csv']);

function extensionFor(mimeType: string) {
  return ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf', 'application/msword': 'doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx', 'application/vnd.ms-excel': 'xls', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx', 'text/plain': 'txt', 'text/csv': 'csv' } as Record<string, string>)[mimeType] ?? 'bin';
}

function resolveStorageKey(storageKey: string) {
  const resolved = path.resolve(storageRoot, storageKey);
  if (!resolved.startsWith(`${storageRoot}${path.sep}`)) throw new HttpError(400, 'Invalid storage key');
  return resolved;
}

function decodeBase64(contentBase64: string, mimeType: string) {
  const encoded = contentBase64.includes(',') ? contentBase64.slice(contentBase64.indexOf(',') + 1) : contentBase64;
  const buffer = Buffer.from(encoded, 'base64');
  if (!buffer.length) throw new HttpError(400, 'File content is empty');
  if (buffer.length > maxFileBytes) throw new HttpError(413, 'File must be 10 MB or smaller');
  if (!allowedMimeTypes.has(mimeType)) throw new HttpError(400, 'Unsupported document type');
  validateFileContent(buffer, mimeType);
  return buffer;
}

function validateFileContent(buffer: Buffer, mimeType: string) {
  if (mimeType === 'image/jpeg' && !(buffer.length > 4 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer.at(-2) === 0xff && buffer.at(-1) === 0xd9)) throw new HttpError(400, 'JPEG content is invalid');
  if (mimeType === 'image/webp' && !(buffer.length > 12 && buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP')) throw new HttpError(400, 'WebP content is invalid');
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
  async writeBase64(patientId: string, contentBase64: string, mimeType: string) {
    return this.writeBuffer(patientId, decodeBase64(contentBase64, mimeType), mimeType);
  },
  async writeBuffer(patientId: string, buffer: Buffer, mimeType: string) {
    if (buffer.length > maxFileBytes) throw new HttpError(413, 'File must be 10 MB or smaller');
    if (!allowedMimeTypes.has(mimeType)) throw new HttpError(400, 'Unsupported file type');
    const storageKey = path.posix.join(patientId, `${crypto.randomUUID()}.${extensionFor(mimeType)}`);
    const target = resolveStorageKey(storageKey);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, buffer, { flag: 'wx', mode: 0o600 });
    return { storageKey, sizeBytes: buffer.length, checksum: crypto.createHash('sha256').update(buffer).digest('hex') };
  },
  read(storageKey: string) { return readFile(resolveStorageKey(storageKey)); },
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
