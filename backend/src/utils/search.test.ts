import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeSearchTerm, rankSearchResult, textSearchVariants } from './search.js';

test('normalizes search whitespace', () => {
  assert.equal(normalizeSearchTerm('  acne   cream '), 'acne cream');
});

test('short searches remain prefix-oriented', () => {
  assert.deepEqual(textSearchVariants('c'), [
    { startsWith: 'c', mode: 'insensitive' },
    { contains: ' c', mode: 'insensitive' },
  ]);
});

test('specific searches include substring matching', () => {
  assert.equal(textSearchVariants('para').at(-1)?.contains, 'para');
});

test('primary name prefixes rank above secondary metadata matches', () => {
  const nameMatch = rankSearchResult('c', ['Cetaphil'], ['Face wash']);
  const formMatch = rankSearchResult('c', ['Acne gel'], ['Cream']);
  assert.ok(nameMatch < formMatch);
});

