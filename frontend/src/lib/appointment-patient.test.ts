import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveAppointmentPatientId } from '../modules/appointments/appointment-patient';
import type { Appointment } from '@/types/appointment';

function appointmentWith(lead: Appointment['lead'], patientId?: string | null) {
  return { lead, patientId } as Appointment;
}

test('appointment navigation uses the patient resolved by the API', () => {
  assert.equal(resolveAppointmentPatientId(appointmentWith(undefined, 'api-patient')), 'api-patient');
});

test('appointment navigation prefers the direct lead patient', () => {
  assert.equal(resolveAppointmentPatientId(appointmentWith({
    id: 'lead-1',
    patient: { id: 'direct-patient', patientNo: '2026-0002', fullName: 'Direct Patient' },
    person: { id: 'person-1', patient: { id: 'person-patient', patientNo: '2026-0001', fullName: 'Person Patient' } },
  } as Appointment['lead'], 'api-patient')), 'direct-patient');
});

test('appointment navigation falls back from the direct lead patient to the shared person patient', () => {
  assert.equal(resolveAppointmentPatientId(appointmentWith({
    id: 'lead-1',
    patient: null,
    person: { id: 'person-1', patient: { id: 'person-patient', patientNo: '2026-0001', fullName: 'Patient' } },
  } as Appointment['lead'])), 'person-patient');
});

test('appointment navigation keeps the details fallback when no patient is safely linked', () => {
  assert.equal(resolveAppointmentPatientId(appointmentWith({ id: 'lead-1', patient: null, person: null } as Appointment['lead'])), null);
});
