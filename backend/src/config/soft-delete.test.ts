import assert from 'node:assert/strict';
import test from 'node:test';
import { withSoftDeleteFilter } from './soft-delete.js';

test('reads of soft-deletable models skip deleted rows', () => {
  assert.deepEqual(withSoftDeleteFilter('Patient', 'findMany', { where: { branchId: 'b1' } }), { where: { branchId: 'b1', deletedAt: null } });
  assert.deepEqual(withSoftDeleteFilter('Lead', 'count', undefined), { where: { deletedAt: null } });
  assert.deepEqual(withSoftDeleteFilter('Appointment', 'findUnique', { where: { id: 'a1' }, include: { service: true } }), { where: { id: 'a1', deletedAt: null }, include: { service: true } });
});

test('explicit deletedAt filters, writes and other models are left alone', () => {
  const explicit = { where: { deletedAt: { not: null } } };
  assert.deepEqual(withSoftDeleteFilter('Patient', 'findMany', explicit), explicit);
  const write = { where: { id: 'p1' }, data: { fullName: 'A' } };
  assert.equal(withSoftDeleteFilter('Patient', 'update', write), write);
  const other = { where: { id: 'u1' } };
  assert.equal(withSoftDeleteFilter('User', 'findUnique', other), other);
});
