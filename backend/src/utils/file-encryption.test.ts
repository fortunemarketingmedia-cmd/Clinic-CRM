import assert from 'node:assert/strict';
import test from 'node:test';
import { decryptFileBuffer, encryptFileBuffer, isEncryptedFileBuffer } from './file-encryption.js';

const key = Buffer.alloc(32, 7);

test('patient-file encryption is authenticated and round-trips exactly', () => {
  const plaintext = Buffer.from('confidential patient document');
  const encrypted = encryptFileBuffer(plaintext, key);
  assert.equal(isEncryptedFileBuffer(encrypted), true);
  assert.notDeepEqual(encrypted, plaintext);
  assert.deepEqual(decryptFileBuffer(encrypted, key), plaintext);
});

test('patient-file encryption rejects tampering and the wrong key', () => {
  const encrypted = encryptFileBuffer(Buffer.from('before photo'), key);
  encrypted[encrypted.length - 1] ^= 1;
  assert.throws(() => decryptFileBuffer(encrypted, key));
  assert.throws(() => decryptFileBuffer(encryptFileBuffer(Buffer.from('after photo'), key), Buffer.alloc(32, 8)));
});

test('patient-file encryption rejects plaintext and malformed keys', () => {
  assert.equal(isEncryptedFileBuffer(Buffer.from('legacy plaintext')), false);
  assert.throws(() => decryptFileBuffer(Buffer.from('legacy plaintext'), key));
  assert.throws(() => encryptFileBuffer(Buffer.from('document'), Buffer.alloc(16)));
});
