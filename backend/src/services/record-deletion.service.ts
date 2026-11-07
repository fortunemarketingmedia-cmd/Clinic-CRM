import type { Prisma } from '@prisma/client';
import { prisma, type DbTransaction } from '../config/db.js';
import { HttpError } from '../utils/http-error.js';
import { auditService, type AuditContext } from './audit.service.js';

// Admin "Delete" across the CRM. Nothing is erased: the record gets `deletedAt`/`deletedById`, disappears from every
// list (see the soft-delete extension in config/db.ts) and a full snapshot is written to the audit log.
// Signed consents and signed prescriptions are legal documents and are never deletable, so they are not listed here.
export const deletableRecords = [
  'patient', 'lead', 'follow-up', 'task', 'waitlist', 'appointment', 'treatment-record', 'encounter', 'sitting', 'file', 'invoice', 'package',
] as const;
export type DeletableRecord = (typeof deletableRecords)[number];

type Stamp = { deletedAt: Date; deletedById: string };
type Deleted = { entity: string; branchId?: string | null; snapshot: unknown; cascaded?: Record<string, number> };
const openWork = { in: ['OPEN', 'IN_PROGRESS', 'OVERDUE'] as Array<'OPEN' | 'IN_PROGRESS' | 'OVERDUE'> };
const finishedAppointments = ['COMPLETED', 'CANCELLED', 'NO_SHOW'] as const;
const lockedEncounterStatuses = ['SIGNED', 'LOCKED', 'ADDENDUM_ADDED'];
const notFound = (label: string) => new HttpError(404, `${label} not found or already deleted`);
const toJson = (value: unknown) => JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;

const handlers: Record<DeletableRecord, (tx: DbTransaction, id: string, stamp: Stamp) => Promise<Deleted>> = {
  async patient(tx, id, stamp) {
    const patient = await tx.patient.findUnique({ where: { id } });
    if (!patient) throw notFound('Patient');
    const followUps = await tx.followUp.updateMany({ where: { patientId: id, deletedAt: null, status: openWork }, data: stamp });
    const tasks = await tx.task.updateMany({ where: { patientId: id, deletedAt: null, status: openWork }, data: stamp });
    const waitlist = await tx.waitlistEntry.updateMany({ where: { patientId: id, deletedAt: null }, data: stamp });
    const appointments = patient.leadId
      ? await tx.appointment.updateMany({ where: { leadId: patient.leadId, deletedAt: null, status: { notIn: [...finishedAppointments] } }, data: stamp })
      : { count: 0 };
    // Free the unique lead/person links so the same person can be registered again later; the originals stay in the audit snapshot.
    await tx.patient.update({ where: { id }, data: { ...stamp, leadId: null, personId: null } });
    return { entity: 'Patient', branchId: patient.branchId, snapshot: patient, cascaded: { followUps: followUps.count, tasks: tasks.count, waitlist: waitlist.count, upcomingAppointments: appointments.count } };
  },
  async lead(tx, id, stamp) {
    const lead = await tx.lead.findUnique({ where: { id }, include: { patient: { select: { id: true, fullName: true, deletedAt: true } } } });
    if (!lead) throw notFound('Lead');
    if (lead.patient && !lead.patient.deletedAt) throw new HttpError(409, `This lead is now the patient ${lead.patient.fullName}. Delete the patient record instead.`);
    const followUps = await tx.followUp.updateMany({ where: { leadId: id, deletedAt: null, status: openWork }, data: stamp });
    const tasks = await tx.task.updateMany({ where: { leadId: id, deletedAt: null, status: openWork }, data: stamp });
    const appointments = await tx.appointment.updateMany({ where: { leadId: id, deletedAt: null, status: { notIn: [...finishedAppointments] } }, data: stamp });
    await tx.lead.update({ where: { id }, data: stamp });
    const { patient: _patient, ...snapshot } = lead; void _patient;
    return { entity: 'Lead', branchId: lead.branchId, snapshot, cascaded: { followUps: followUps.count, tasks: tasks.count, upcomingAppointments: appointments.count } };
  },
  async 'follow-up'(tx, id, stamp) {
    const followUp = await tx.followUp.findUnique({ where: { id } });
    if (!followUp) throw notFound('Follow-up');
    await tx.followUp.update({ where: { id }, data: stamp });
    return { entity: 'FollowUp', branchId: followUp.branchId, snapshot: followUp };
  },
  async task(tx, id, stamp) {
    const task = await tx.task.findUnique({ where: { id } });
    if (!task) throw notFound('Task');
    await tx.task.update({ where: { id }, data: stamp });
    return { entity: 'Task', branchId: task.branchId, snapshot: task };
  },
  async waitlist(tx, id, stamp) {
    const entry = await tx.waitlistEntry.findUnique({ where: { id } });
    if (!entry) throw notFound('Waitlist entry');
    await tx.waitlistEntry.update({ where: { id }, data: stamp });
    return { entity: 'WaitlistEntry', branchId: entry.branchId, snapshot: entry };
  },
  async appointment(tx, id, stamp) {
    const appointment = await tx.appointment.findUnique({ where: { id } });
    if (!appointment) throw notFound('Appointment');
    await tx.appointment.update({ where: { id }, data: stamp });
    return { entity: 'Appointment', branchId: appointment.branchId, snapshot: appointment };
  },
  async 'treatment-record'(tx, id, stamp) {
    const session = await tx.session.findUnique({ where: { id }, include: { patient: { select: { branchId: true } } } });
    if (!session) throw notFound('Treatment record');
    await tx.session.update({ where: { id }, data: { ...stamp, appointmentId: null } });
    const { patient, ...snapshot } = session;
    return { entity: 'Session', branchId: patient.branchId, snapshot };
  },
  async encounter(tx, id, stamp) {
    const encounter = await tx.clinicalEncounter.findUnique({ where: { id } });
    if (!encounter) throw notFound('Consultation note');
    if (lockedEncounterStatuses.includes(encounter.status)) throw new HttpError(409, 'Signed consultation notes are locked and cannot be deleted');
    await tx.clinicalEncounter.update({ where: { id }, data: { ...stamp, legacySessionId: null } });
    return { entity: 'ClinicalEncounter', branchId: encounter.branchId, snapshot: encounter };
  },
  async sitting(tx, id, stamp) {
    const sitting = await tx.procedureSession.findUnique({ where: { id } });
    if (!sitting) throw notFound('Sitting');
    const cascaded: Record<string, number> = {};
    if (sitting.status === 'COMPLETED' && sitting.treatmentPlanItemId) {
      const item = await tx.treatmentPlanItem.findUnique({ where: { id: sitting.treatmentPlanItemId } });
      if (item && item.completedSessions > 0) await tx.treatmentPlanItem.update({ where: { id: item.id }, data: { completedSessions: { decrement: 1 } } });
    }
    if (sitting.status === 'COMPLETED' && sitting.packageId) {
      // Give the package session back, with a reversal entry in the package ledger.
      const treatmentPackage = await tx.treatmentPackage.findUnique({ where: { id: sitting.packageId } });
      if (treatmentPackage && treatmentPackage.completedSessions > 0) {
        const updated = await tx.treatmentPackage.update({
          where: { id: treatmentPackage.id },
          data: { completedSessions: { decrement: 1 }, status: treatmentPackage.status === 'COMPLETED' ? 'ACTIVE' : undefined },
        });
        await tx.packageSessionLedger.create({ data: {
          patientPackageId: updated.id, action: 'SESSION_REVERSAL', sessionDelta: 1, consumedDelta: -1, procedureSessionId: id, createdById: stamp.deletedById,
          balanceRemaining: Math.max(0, updated.totalSessions - updated.completedSessions - updated.reservedSessions), notes: 'Sitting deleted',
        } });
        cascaded.packageSessionsReturned = 1;
      }
    }
    await tx.procedureSession.update({ where: { id }, data: stamp });
    return { entity: 'ProcedureSession', branchId: sitting.branchId, snapshot: sitting, cascaded };
  },
  async file(tx, id, stamp) {
    const file = await tx.patientFile.findUnique({ where: { id }, include: { patient: { select: { branchId: true } } } });
    if (!file) throw notFound('File');
    if (file.fileType === 'CONSENT') throw new HttpError(409, 'Signed consent documents are locked and cannot be deleted');
    const variants = await tx.patientFile.updateMany({ where: { originalFileId: id, deletedAt: null }, data: stamp });
    await tx.patientFile.update({ where: { id }, data: stamp });
    const { patient, ...snapshot } = file;
    return { entity: 'PatientFile', branchId: patient.branchId, snapshot, cascaded: { variants: variants.count } };
  },
  async invoice(tx, id, stamp) {
    const invoice = await tx.invoice.findUnique({ where: { id }, include: { items: true } });
    if (!invoice) throw notFound('Invoice');
    // Payments taken only for this invoice are hidden with it, so totals and collections stay consistent.
    const payments = await tx.payment.updateMany({
      where: { deletedAt: null, OR: [{ invoiceId: id }, { AND: [{ allocations: { some: { invoiceId: id } } }, { allocations: { every: { invoiceId: id } } }] }] },
      data: stamp,
    });
    await tx.invoice.update({ where: { id }, data: stamp });
    return { entity: 'Invoice', branchId: invoice.branchId, snapshot: invoice, cascaded: { payments: payments.count } };
  },
  async package(tx, id, stamp) {
    const treatmentPackage = await tx.treatmentPackage.findUnique({ where: { id } });
    if (!treatmentPackage) throw notFound('Package');
    await tx.treatmentPackage.update({ where: { id }, data: stamp });
    return { entity: 'TreatmentPackage', branchId: treatmentPackage.branchId, snapshot: treatmentPackage };
  },
};

export const recordDeletionService = {
  async softDelete(kind: DeletableRecord, id: string, actorId: string, audit: AuditContext) {
    const stamp = { deletedAt: new Date(), deletedById: actorId };
    const result = await prisma.$transaction((tx) => handlers[kind](tx, id, stamp));
    await auditService.record(
      { ...audit, branchId: result.branchId ?? undefined },
      { action: 'RECORD_DELETED', entity: result.entity, entityId: id, previousValue: toJson(result.snapshot), newValue: toJson({ deletedAt: stamp.deletedAt, deletedById: actorId, cascaded: result.cascaded ?? {} }) },
    );
    return { id, kind, deleted: true, cascaded: result.cascaded ?? {} };
  },
};
