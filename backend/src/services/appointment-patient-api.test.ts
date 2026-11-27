import assert from 'node:assert/strict';
import test from 'node:test';
import { Role } from '@prisma/client';
import { appointmentRepository } from '../repositories/appointment.repository.js';
import { branchRepository } from '../repositories/branch.repository.js';
import { accessService } from './access.service.js';
import { appointmentService } from './appointment.service.js';

test('appointments API exposes a patientId resolved through the shared person', async (t) => {
  t.mock.method(branchRepository, 'exists', async () => true);
  t.mock.method(accessService, 'assertBranchAccess', async () => undefined);
  t.mock.method(appointmentRepository, 'list', async () => ({
    items: [{
      id: 'appointment-1',
      branchId: 'appointment-branch',
      lead: {
        patient: null,
        person: { patient: { id: 'existing-patient' } },
      },
    }],
    total: 1,
    page: 1,
    pageSize: 50,
  }) as never);

  const result = await appointmentService.listAppointments({
    branchId: 'appointment-branch',
    role: Role.ADMIN,
    userId: 'admin-1',
    page: 1,
    pageSize: 50,
  });

  assert.equal(result.items[0].patientId, 'existing-patient');
  assert.equal(result.items[0].branchId, 'appointment-branch');
});
