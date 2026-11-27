import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveAppointmentPatientId, withResolvedAppointmentPatient } from './appointment-patient.js';

test('appointment patient resolution prefers the direct lead patient', () => {
  const appointment = {
    id: 'appointment-1',
    lead: {
      patient: { id: 'direct-patient' },
      person: { patient: { id: 'person-patient' } },
    },
  };

  assert.equal(resolveAppointmentPatientId(appointment), 'direct-patient');
  assert.equal(withResolvedAppointmentPatient(appointment).patientId, 'direct-patient');
});

test('appointment patient resolution falls back to the patient on the shared person', () => {
  const appointment = {
    id: 'appointment-2',
    lead: {
      patient: null,
      person: { patient: { id: 'person-patient' } },
    },
  };

  assert.equal(resolveAppointmentPatientId(appointment), 'person-patient');
  assert.equal(withResolvedAppointmentPatient(appointment).patientId, 'person-patient');
});

test('appointment patient resolution remains empty when no safe relationship exists', () => {
  assert.equal(resolveAppointmentPatientId({ lead: { patient: null, person: null } }), null);
  assert.equal(resolveAppointmentPatientId({ lead: null }), null);
});
