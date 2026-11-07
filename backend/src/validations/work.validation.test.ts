import assert from 'node:assert/strict';
import test from 'node:test';
import { completeFollowUpSchema, createFollowUpSchema } from './work.validation.js';

const base = { assignedUserId: 'u1', branchId: 'b1', activityType: 'Check-up follow-up', channel: 'CALL', dueAt: '2026-11-20T10:00:00.000Z' };

test('a patient follow-up can be created without a person id', () => {
  const parsed = createFollowUpSchema.parse({ ...base, patientId: 'p1' });
  assert.equal(parsed.patientId, 'p1');
  assert.equal(parsed.personId, undefined);
});

test('a follow-up needs a person or a patient', () => {
  assert.throws(() => createFollowUpSchema.parse(base));
});

test('completing with a next follow-up accepts its reminder time', () => {
  const parsed = completeFollowUpSchema.parse({ outcome: 'Patient came for check-up', resolution: 'NEXT_ACTION', nextAction: 'Next check-up', nextFollowUpAt: '2026-12-20T10:00:00.000Z', nextReminderAt: '2026-12-19T10:00:00.000Z' });
  assert.equal(parsed.nextReminderAt?.toISOString(), '2026-12-19T10:00:00.000Z');
});
