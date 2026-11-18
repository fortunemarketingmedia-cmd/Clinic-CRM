import { gzipSync, gunzipSync } from 'node:zlib';

const compressedMagic = Buffer.from('RVCGZIP1');
export const compressedHeaderBytes = compressedMagic.length;

export function storedFileIsCompressed(originalBytes: number | null, storedBytes: number | null, encryptionOverhead: number) {
  return originalBytes !== null && storedBytes !== null && storedBytes - encryptionOverhead < originalBytes;
}

export function packStoredFile(buffer: Buffer, mimeType: string) {
  if (!['text/plain', 'text/csv'].includes(mimeType)) return buffer;
  const compressed = gzipSync(buffer);
  return compressed.length + compressedMagic.length < buffer.length
    ? Buffer.concat([compressedMagic, compressed]) : buffer;
}

export function unpackStoredFile(buffer: Buffer, maxBytes: number) {
  return buffer.subarray(0, compressedMagic.length).equals(compressedMagic)
    ? gunzipSync(buffer.subarray(compressedMagic.length), { maxOutputLength: maxBytes }) : buffer;
}
