import assert from 'node:assert/strict';
import test from 'node:test';
import { filterAndRankSearch } from './search';

const records = [
  { name: 'Acne cream', category: 'Cream' },
  { name: 'Cetaphil cleanser', category: 'Face wash' },
  { name: 'Vitamin C serum', category: 'Serum' },
];

test('one character searches match word prefixes instead of arbitrary substrings', () => {
  assert.deepEqual(filterAndRankSearch(records, 'c', (item) => [item.name]).map((item) => item.name), [
    'Cetaphil cleanser',
    'Acne cream',
    'Vitamin C serum',
  ]);
});

test('primary matches rank above secondary metadata matches', () => {
  assert.deepEqual(filterAndRankSearch(records, 'c', (item) => [item.name], (item) => [item.category]).map((item) => item.name), [
    'Cetaphil cleanser',
    'Acne cream',
    'Vitamin C serum',
  ]);
});

