import type { WaitlistStatus, WorkPriority } from '@prisma/client';
import { prisma } from '../config/db.js';
export const waitlistRepository = {
  list(filters: { branchId?: string; status?: WaitlistStatus; serviceId?: string }) { return prisma.waitlistEntry.findMany({ where: { branchId: filters.branchId, status: filters.status, serviceId: filters.serviceId }, include: { person: true, patient: true, branch: true, service: true, preferredDoctor: { select: { id: true, name: true } }, assignedUser: { select: { id: true, name: true } }, appointment: true }, orderBy: [{ priority: 'desc' }, { preferredFrom: 'asc' }] }); },
  findById(id: string) { return prisma.waitlistEntry.findUnique({ where: { id }, include: { person: { include: { leads: { orderBy: { createdAt: 'desc' } } } }, patient: true, service: true } }); },
  create(data: { personId: string; patientId?: string; branchId: string; serviceId?: string; requestedService: string; preferredDoctorId?: string; preferredFrom: Date; preferredTo: Date; preferredTimeFrom?: number; preferredTimeTo?: number; priority: WorkPriority; notes?: string; expiresAt?: Date; assignedUserId?: string }) { return prisma.waitlistEntry.create({ data, include: { person: true, patient: true, service: true, preferredDoctor: { select: { id: true, name: true } } } }); },
  update(id: string, data: Partial<{ status: WaitlistStatus; contactStatus: string; notes: string; assignedUserId: string; notifiedAt: Date; respondedAt: Date; appointmentId: string }>) { return prisma.waitlistEntry.update({ where: { id }, data, include: { person: true, patient: true, service: true, appointment: true } }); },
};

