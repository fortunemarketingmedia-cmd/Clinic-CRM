import type { Role } from '@prisma/client';
import { Role as RoleEnum } from '@prisma/client';
import { prisma } from '../config/db.js';
import { HttpError } from '../utils/http-error.js';

const globalRoles: Role[] = [RoleEnum.ADMIN];

export const accessService = {
  async assertRelatedRecords(branchId: string, input: { personId?: string; leadId?: string; patientId?: string; relatedAppointmentId?: string }) {
    const [person, lead, patient, appointment] = await Promise.all([
      input.personId ? prisma.person.findFirst({ where: { id: input.personId, OR: [{ preferredBranchId: branchId }, { leads: { some: { branchId, deletedAt: null } } }, { patient: { is: { branchId, deletedAt: null } } }] }, select: { id: true } }) : null,
      input.leadId ? prisma.lead.findUnique({ where: { id: input.leadId }, select: { branchId: true, personId: true } }) : null,
      input.patientId ? prisma.patient.findUnique({ where: { id: input.patientId }, select: { branchId: true, personId: true } }) : null,
      input.relatedAppointmentId ? prisma.appointment.findUnique({ where: { id: input.relatedAppointmentId }, select: { branchId: true, leadId: true } }) : null,
    ]);
    if (input.personId && !person || input.leadId && (!lead || lead.branchId !== branchId) || input.patientId && (!patient || patient.branchId !== branchId) || input.relatedAppointmentId && (!appointment || appointment.branchId !== branchId)) throw new HttpError(403, 'Related records must belong to the selected branch');
    if (input.personId && [lead?.personId, patient?.personId].some((id) => id && id !== input.personId) || input.leadId && appointment && appointment.leadId !== input.leadId || lead?.personId && patient?.personId && lead.personId !== patient.personId) throw new HttpError(400, 'Related records must identify the same person');
  },
  async assertBranchAccess(userId: string, role: Role, branchId?: string) {
    if (globalRoles.includes(role)) return;
    if (!branchId) throw new HttpError(400, 'Select a branch to continue');

    const assignment = await prisma.userBranch.findUnique({
      where: { userId_branchId: { userId, branchId } },
      select: { userId: true },
    });

    if (!assignment) throw new HttpError(403, 'You do not have access to this branch');
  },
};
