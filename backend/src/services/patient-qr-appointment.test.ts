import assert from 'node:assert/strict';
import test from 'node:test';
import { appointmentRepository } from '../repositories/appointment.repository.js';
import { formsRepository } from '../repositories/forms.repository.js';
import { leadRepository } from '../repositories/lead.repository.js';
import { patientRepository } from '../repositories/patient.repository.js';
import { timelineRepository } from '../repositories/timeline.repository.js';
import { patientService } from './patient.service.js';

test('QR form submission books a consultation at the server submission time', async (t) => {
  const patient = {
    id: 'patient-1',
    patientNo: '2026-0001',
    qrToken: 'patient-token',
    leadId: 'lead-1',
    branchId: 'branch-1',
    fullName: 'Test Patient',
    mobile: '9876543210',
  };
  const before = Date.now();
  let bookedAt: Date | undefined;

  t.mock.method(leadRepository, 'findByQrToken', async () => null);
  t.mock.method(patientRepository, 'findByQrToken', async () => patient as never);
  t.mock.method(patientRepository, 'submitQrProfile', async () => patient as never);
  t.mock.method(formsRepository, 'findPublishedRegistrationTemplate', async () => null);
  t.mock.method(timelineRepository, 'create', async () => ({ id: 'timeline-1' }) as never);
  t.mock.method(appointmentRepository, 'createForQrSubmission', async (_patientId: string, submittedAt: Date) => {
    bookedAt = submittedAt;
    return { appointment: { id: 'appointment-1', leadId: 'lead-1' }, created: true } as never;
  });

  await patientService.submitQrRegistration('patient-token', { fullName: patient.fullName, mobile: patient.mobile });

  assert.ok(bookedAt);
  assert.ok(bookedAt.getTime() >= before);
  assert.ok(bookedAt.getTime() <= Date.now());
});
