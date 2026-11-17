import assert from 'node:assert/strict';
import test from 'node:test';
import { amountInWords } from './amount-in-words.js';

test('amounts are written in Indian grouping', () => {
  assert.equal(amountInWords(0), 'Rupees Zero Only');
  assert.equal(amountInWords(1250), 'Rupees One Thousand Two Hundred Fifty Only');
  assert.equal(amountInWords(24000), 'Rupees Twenty Four Thousand Only');
  assert.equal(amountInWords(125000.5), 'Rupees One Lakh Twenty Five Thousand and Fifty Paise Only');
  assert.equal(amountInWords(12345678), 'Rupees One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight Only');
});
