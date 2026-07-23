import assert from 'node:assert/strict';
import test from 'node:test';
import { scoreLead } from './lead-scoring-policy.js';

test('lead scoring explains each applied rule', () => {
  const result = scoreLead([
    { name: 'Appointment', field: 'appointmentCount', operator: 'GREATER_THAN', value: '0', points: 30 },
    { name: 'Urgent', field: 'priority', operator: 'EQUALS', value: 'HIGH,URGENT', points: 20 },
  ], { appointmentCount: 1, priority: 'URGENT' });
  assert.equal(result.score, 50);
  assert.equal(result.category, 'WARM');
  assert.deepEqual(result.reasons, [{ rule: 'Appointment', points: 30 }, { rule: 'Urgent', points: 20 }]);
});

