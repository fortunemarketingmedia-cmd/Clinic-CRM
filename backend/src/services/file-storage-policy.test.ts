import assert from 'node:assert/strict';
import test from 'node:test';
import { fileStorageService } from './file-storage.service.js';

test('secure file access tokens are scoped and expire', () => {
  const token = fileStorageService.createAccessToken('file-a', Date.now() + 60_000);
  assert.equal(fileStorageService.verifyAccessToken('file-a', token), true);
  assert.equal(fileStorageService.verifyAccessToken('file-b', token), false);
  assert.equal(fileStorageService.verifyAccessToken('file-a', fileStorageService.createAccessToken('file-a', Date.now() - 1)), false);
});

test('legacy data URLs are decoded without exposing their permanent URL', () => {
  const result = fileStorageService.decodeLegacyDataUrl('data:text/plain;base64,SGVsbG8=');
  assert.equal(result.buffer.toString(), 'Hello');
});

test('malformed image content is rejected before storage or PDF rendering', async () => {
  await assert.rejects(
    fileStorageService.writeBase64('patient-a', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+3xqN9QAAAABJRU5ErkJggg==', 'image/png'),
    /PNG content is invalid/,
  );
});
