import assert from 'node:assert/strict';
import test from 'node:test';
import { assertEncounterEditable, assertTreatmentPlanTransition } from './clinical-policy.js';

test('signed and locked clinical encounters cannot be edited', () => {
  assert.doesNotThrow(() => assertEncounterEditable('DRAFT'));
  assert.throws(() => assertEncounterEditable('SIGNED'), /locked/i);
  assert.throws(() => assertEncounterEditable('LOCKED'), /locked/i);
});

test('treatment plan lifecycle rejects skipped states', () => {
  assert.doesNotThrow(() => assertTreatmentPlanTransition('DRAFT', 'PROPOSED'));
  assert.throws(() => assertTreatmentPlanTransition('DRAFT', 'ACTIVE'), /cannot move/i);
  assert.doesNotThrow(() => assertTreatmentPlanTransition('ON_HOLD', 'ACTIVE'));
});
