import assert from 'node:assert/strict';
import test from 'node:test';
import { procedureSessionSchema } from './patient-360.validation.js';

const required = {
  branchId: 'branch-1',
  procedureName: 'HIFU',
  practitionerId: 'doctor-1',
};

test('procedure sitting accepts a name and Other type', () => {
  const other = procedureSessionSchema.parse({
    ...required,
    sittingName: 'Manual review',
    chartType: 'OTHER',
  });
  assert.equal(other.sittingName, 'Manual review');
  assert.equal(other.chartType, 'OTHER');
});

test('procedure sitting accepts HIFU face & neck KJ boxes', () => {
  const hifu = procedureSessionSchema.parse({
    ...required,
    sittingName: 'Full face HIFU',
    chartType: 'HIFU',
    chartValues: { 'd45-R1': ' 1.2 ', 'd30-C1': '0.8', 'd15-L13': 'NR' },
  });
  assert.equal(hifu.chartType, 'HIFU');
  assert.deepEqual(hifu.chartValues, { 'd45-R1': '1.2', 'd30-C1': '0.8', 'd15-L13': 'NR' });
});

test('procedure sitting rejects unknown HIFU box ids', () => {
  assert.throws(() => procedureSessionSchema.parse({ ...required, chartType: 'HIFU', chartValues: { forehead: '1.2' } }));
});
