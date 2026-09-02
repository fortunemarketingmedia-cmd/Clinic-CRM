import crypto from 'node:crypto';

export const fileEncryptionMagic = Buffer.from('RVCFILE1', 'ascii');
const ivBytes = 12;
const tagBytes = 16;

export function encryptFileBuffer(buffer: Buffer, key: Buffer) {
  if (key.length !== 32) throw new Error('File encryption key must be exactly 32 bytes');
  const iv = crypto.randomBytes(ivBytes);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(fileEncryptionMagic);
  const ciphertext = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return Buffer.concat([fileEncryptionMagic, iv, cipher.getAuthTag(), ciphertext]);
}

export function isEncryptedFileBuffer(buffer: Buffer) {
  return buffer.subarray(0, fileEncryptionMagic.length).equals(fileEncryptionMagic);
}

export function decryptFileBuffer(buffer: Buffer, key: Buffer) {
  if (key.length !== 32) throw new Error('File encryption key must be exactly 32 bytes');
  if (!isEncryptedFileBuffer(buffer)) throw new Error('Stored file does not have a supported encryption envelope');
  const ivStart = fileEncryptionMagic.length;
  const tagStart = ivStart + ivBytes;
  const contentStart = tagStart + tagBytes;
  if (buffer.length <= contentStart) throw new Error('Stored file encryption envelope is incomplete');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, buffer.subarray(ivStart, tagStart));
  decipher.setAAD(fileEncryptionMagic);
  decipher.setAuthTag(buffer.subarray(tagStart, contentStart));
  return Buffer.concat([decipher.update(buffer.subarray(contentStart)), decipher.final()]);
}
