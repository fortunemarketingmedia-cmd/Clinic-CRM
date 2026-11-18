import assert from 'node:assert/strict';
import test from 'node:test';
import { csvCell } from './csv.js';

test('CSV export escapes quotes and neutralizes spreadsheet formulas without changing numeric values', () => {
  assert.equal(csvCell('A "quoted", name'), '"A ""quoted"", name"');
  for (const text of ['=1+1', '+CMD()', '@SUM(A1)', '-1+2', '\t=1+1'])
    assert.equal(csvCell(text), `"'${text}"`);
  assert.equal(csvCell(-10), '"-10"');
  assert.equal(csvCell('Ordinary name'), '"Ordinary name"');
});
