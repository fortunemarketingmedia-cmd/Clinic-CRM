import type { Role } from '@prisma/client';
import type { z } from 'zod';
import { waitlistRepository } from '../repositories/waitlist.repository.js';
import { HttpError } from '../utils/http-error.js';
import type { bookWaitlistSchema, createWaitlistSchema, updateWaitlistSchema, waitlistQuerySchema } from '../validations/waitlist.validation.js';
import { accessService } from './access.service.js';
import { appointmentService } from './appointment.service.js';
import { auditService, type AuditContext } from './audit.service.js';

type Query = z.infer<typeof waitlistQuerySchema>; type Create = z.infer<typeof createWaitlistSchema>; type Update = z.infer<typeof updateWaitlistSchema>; type Book = z.infer<typeof bookWaitlistSchema>;
export const waitlistService = {
  async list(input: Query & { userId: string; role: Role }) { await accessService.assertBranchAccess(input.userId, input.role, input.branchId); return waitlistRepository.list(input); },
  async create(input: Create & { userId: string; role: Role }, audit: AuditContext) { await accessService.assertBranchAccess(input.userId, input.role, input.branchId); const entry = await waitlistRepository.create(input); await auditService.record({ ...audit, branchId: input.branchId }, { action: 'WAITLIST_CREATED', entity: 'WaitlistEntry', entityId: entry.id }); return entry; },
  async update(id: string, input: Update, userId: string, role: Role, audit: AuditContext) { const existing = await waitlistRepository.findById(id); if (!existing) throw new HttpError(404, 'Waitlist entry not found'); await accessService.assertBranchAccess(userId, role, existing.branchId); const timed = input.status === 'NOTIFIED' ? { notifiedAt: new Date() } : input.status === 'ACCEPTED' || input.status === 'DECLINED' ? { respondedAt: new Date() } : {}; const entry = await waitlistRepository.update(id, { ...input, ...timed }); await auditService.record({ ...audit, branchId: existing.branchId }, { action: 'WAITLIST_UPDATED', entity: 'WaitlistEntry', entityId: id, newValue: { status: entry.status } }); return entry; },
  async book(id: string, input: Book, userId: string, role: Role, audit: AuditContext) {
    const entry = await waitlistRepository.findById(id); if (!entry) throw new HttpError(404, 'Waitlist entry not found'); if (!['ACTIVE', 'NOTIFIED', 'ACCEPTED'].includes(entry.status)) throw new HttpError(409, 'Waitlist entry is not bookable');
    await accessService.assertBranchAccess(userId, role, entry.branchId);
    const serviceId = input.serviceId ?? entry.serviceId ?? undefined;
    const appointment = await appointmentService.createAppointment({ leadId: entry.person.leads[0]?.id, name: entry.person.fullName, mobile: entry.person.primaryMobile, source: 'PHONE_CALL', branchId: entry.branchId, createdById: userId, appointmentAt: input.appointmentAt, appointmentType: 'CLINIC_VISIT', resourceType: entry.service?.resourceType ?? 'CONSULTATION', serviceId, doctorId: input.doctorId ?? entry.preferredDoctorId ?? undefined, therapistId: input.therapistId, resourceId: input.resourceId, equipmentId: input.equipmentId, notes: input.notes });
    const updated = await waitlistRepository.update(id, { status: 'BOOKED', appointmentId: appointment.id, respondedAt: new Date() });
    await auditService.record({ ...audit, branchId: entry.branchId }, { action: 'WAITLIST_BOOKED', entity: 'WaitlistEntry', entityId: id, newValue: { appointmentId: appointment.id } });
    return updated;
  },
};
