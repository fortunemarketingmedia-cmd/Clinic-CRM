import assert from 'node:assert/strict';
import test from 'node:test';
import { packStoredFile, storedFileIsCompressed, unpackStoredFile } from './stored-file.js';

test('text storage compression round trips while signed PDFs and images keep exact bytes', () => {
  const text = Buffer.from('Synthetic clinical text.\n'.repeat(2000));
  const compressed = packStoredFile(text, 'text/plain');
  assert.ok(compressed.length < text.length / 5);
  assert.deepEqual(unpackStoredFile(compressed, text.length), text);
  assert.throws(() => unpackStoredFile(compressed, 20));
  for (const mime of ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']) {
    assert.equal(packStoredFile(text, mime), text);
  }
});

test('legacy or uncompressed text with a compression marker is identified by recorded sizes', () => {
  const bytes = Buffer.from('RVCGZIP1 is literal text');
  assert.equal(packStoredFile(bytes, 'text/plain'), bytes);
  assert.equal(storedFileIsCompressed(bytes.length, null, 36), false);
  assert.equal(storedFileIsCompressed(bytes.length, bytes.length + 36, 36), false);
  assert.equal(storedFileIsCompressed(2000, 100, 36), true);
});
