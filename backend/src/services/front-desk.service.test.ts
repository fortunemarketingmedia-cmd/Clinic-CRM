import assert from 'node:assert/strict';
import test from 'node:test';
import { frontDeskRepository } from '../repositories/front-desk.repository.js';
import { frontDeskService } from './front-desk.service.js';

type ExistingAppointment = Awaited<ReturnType<typeof frontDeskRepository.findPotentialConflicts>>[number];
type AvailabilityInput = Parameters<typeof frontDeskService.availability>[0];

const request: AvailabilityInput = {
  branchId: 'branch-1',
  resourceType: 'CONSULTATION',
  startsAt: new Date('2026-09-15T15:37:00Z'),
  durationMinutes: 30,
  bufferMinutes: 10,
};

function booking(overrides: Partial<ExistingAppointment> = {}): ExistingAppointment {
  return {
    id: 'existing-booking',
    appointmentAt: request.startsAt,
    endAt: new Date('2026-09-15T16:07:00Z'),
    durationMinutes: 30,
    bufferMinutes: 10,
    checkInAt: null,
    resourceType: 'CONSULTATION',
    doctorId: null,
    therapistId: null,
    resourceId: null,
    equipmentId: null,
    roomNumber: null,
    ...overrides,
  } as ExistingAppointment;
}

test('availability allows overlapping consultations without shared assignments', async (t) => {
  t.mock.method(frontDeskRepository, 'findPotentialConflicts', async () => [booking()]);
  t.mock.method(frontDeskRepository, 'findExceptions', async () => []);
  const result = await frontDeskService.availability(request);
  assert.equal(result.available, true);
  assert.deepEqual(result.conflicts, []);
});

test('availability still blocks shared staff, rooms, and equipment including buffer time', async (t) => {
  t.mock.method(frontDeskRepository, 'findExceptions', async () => []);
  t.mock.method(frontDeskRepository, 'listSchedules', async () => []);
  for (const assignment of [{ doctorId: 'doctor-1' }, { therapistId: 'therapist-1' }, { resourceId: 'room-1' }, { equipmentId: 'equipment-1' }, { roomNumber: 1 }]) {
    const existing = booking(assignment);
    const mock = t.mock.method(frontDeskRepository, 'findPotentialConflicts', async () => [existing]);
    const result = await frontDeskService.availability({ ...request, ...assignment });
    assert.equal(result.available, false, JSON.stringify(assignment));
    assert.equal(result.conflicts[0].id, existing.id);
    const buffered = await frontDeskService.availability({ ...request, ...assignment, startsAt: new Date('2026-09-15T16:10:00Z') });
    assert.equal(buffered.available, false);
    const adjacent = await frontDeskService.availability({ ...request, ...assignment, startsAt: new Date('2026-09-15T16:17:00Z') });
    assert.equal(adjacent.available, true);
    mock.mock.restore();
  }
});

test('different assigned doctors can take consultations at the same time', async (t) => {
  t.mock.method(frontDeskRepository, 'findPotentialConflicts', async () => [booking({ doctorId: 'doctor-1' })]);
  t.mock.method(frontDeskRepository, 'findExceptions', async () => []);
  t.mock.method(frontDeskRepository, 'listSchedules', async () => []);
  assert.equal((await frontDeskService.availability({ ...request, doctorId: 'doctor-2' })).available, true);
});

test('branch closures still block unassigned consultations', async (t) => {
  t.mock.method(frontDeskRepository, 'findPotentialConflicts', async () => []);
  t.mock.method(frontDeskRepository, 'findExceptions', async () => [{ id: 'closure' }]);
  assert.equal((await frontDeskService.availability(request)).available, false);
});

test('staff working hours still block bookings outside the assigned schedule', async (t) => {
  t.mock.method(frontDeskRepository, 'findPotentialConflicts', async () => []);
  t.mock.method(frontDeskRepository, 'findExceptions', async () => []);
  t.mock.method(frontDeskRepository, 'listSchedules', async () => [{ weekday: 2, startMinutes: 540, endMinutes: 1080 }]);
  const result = await frontDeskService.availability({ ...request, doctorId: 'doctor-1' });
  assert.equal(result.available, false);
  assert.equal(result.outsideSchedule, true);
});
