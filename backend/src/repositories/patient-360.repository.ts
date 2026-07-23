import type { Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';

const encounterInclude = {
  doctor: { select: { id: true, name: true } },
  therapist: { select: { id: true, name: true } },
  signedBy: { select: { id: true, name: true } },
  addendums: { include: { author: { select: { id: true, name: true } } }, orderBy: { createdAt: 'asc' as const } },
  prescriptions: { include: { items: true }, orderBy: { prescribedAt: 'desc' as const } },
};

export const patient360Repository = {
  findPatientAccess(id: string) {
    return prisma.patient.findUnique({ where: { id }, select: { id: true, branchId: true, leadId: true, personId: true } });
  },

  getPatient360(id: string) {
    return prisma.patient.findUnique({
      where: { id },
      include: {
        branch: true,
        assignedDoctor: { select: { id: true, name: true } },
        person: true,
        medicalProfile: { include: { versions: { include: { updatedBy: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } } } },
        lead: { include: { appointments: { include: { doctor: { select: { id: true, name: true } }, service: true }, orderBy: { appointmentAt: 'desc' } } } },
        clinicalEncounters: { include: encounterInclude, orderBy: { visitDate: 'desc' } },
        treatmentPlans: { include: { assignedDoctor: { select: { id: true, name: true } }, assignedTherapist: { select: { id: true, name: true } }, items: { include: { service: true, practitioner: { select: { id: true, name: true } } } } }, orderBy: { createdAt: 'desc' } },
        procedureSessions: { include: { practitioner: { select: { id: true, name: true } }, assistant: { select: { id: true, name: true } }, room: true, device: true }, orderBy: { createdAt: 'desc' } },
        prescriptions: { include: { doctor: { select: { id: true, name: true } }, signedBy: { select: { id: true, name: true } }, items: true }, orderBy: { prescribedAt: 'desc' } },
        packages: { orderBy: { createdAt: 'desc' } },
        invoices: { include: { payments: true }, orderBy: { invoiceDate: 'desc' } },
        files: { orderBy: { createdAt: 'desc' } },
        timelineEvents: { orderBy: { createdAt: 'desc' }, take: 200 },
      },
    });
  },

  listEncounters(patientId: string) {
    return prisma.clinicalEncounter.findMany({ where: { patientId }, include: encounterInclude, orderBy: { visitDate: 'desc' } });
  },
  findEncounter(id: string) {
    return prisma.clinicalEncounter.findUnique({ where: { id }, include: encounterInclude });
  },
  createEncounter(data: Prisma.ClinicalEncounterUncheckedCreateInput) {
    return prisma.clinicalEncounter.create({ data, include: encounterInclude });
  },
  updateEncounter(id: string, data: Prisma.ClinicalEncounterUncheckedUpdateInput) {
    return prisma.clinicalEncounter.update({ where: { id }, data, include: encounterInclude });
  },
  signEncounter(id: string, userId: string) {
    const now = new Date();
    return prisma.clinicalEncounter.update({ where: { id }, data: { status: 'LOCKED', signedById: userId, signedAt: now, lockedAt: now }, include: encounterInclude });
  },
  addEncounterAddendum(encounterId: string, authorId: string, content: string) {
    return prisma.$transaction(async (tx) => {
      const addendum = await tx.clinicalEncounterAddendum.create({ data: { encounterId, authorId, content }, include: { author: { select: { id: true, name: true } } } });
      await tx.clinicalEncounter.update({ where: { id: encounterId }, data: { status: 'ADDENDUM_ADDED' } });
      return addendum;
    });
  },

  listTreatmentPlans(patientId: string) {
    return prisma.treatmentPlan.findMany({ where: { patientId }, include: { items: { include: { service: true, practitioner: { select: { id: true, name: true } } } }, assignedDoctor: { select: { id: true, name: true } }, assignedTherapist: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } });
  },
  findTreatmentPlan(id: string) { return prisma.treatmentPlan.findUnique({ where: { id }, include: { items: true } }); },
  createTreatmentPlan(data: Prisma.TreatmentPlanUncheckedCreateInput) {
    return prisma.treatmentPlan.create({ data, include: { items: true, assignedDoctor: { select: { id: true, name: true } }, assignedTherapist: { select: { id: true, name: true } } } });
  },
  updateTreatmentPlan(id: string, data: Prisma.TreatmentPlanUncheckedUpdateInput) {
    return prisma.treatmentPlan.update({ where: { id }, data, include: { items: true, assignedDoctor: { select: { id: true, name: true } }, assignedTherapist: { select: { id: true, name: true } } } });
  },

  listProcedureSessions(patientId: string) {
    return prisma.procedureSession.findMany({ where: { patientId }, include: { practitioner: { select: { id: true, name: true } }, assistant: { select: { id: true, name: true } }, room: true, device: true, treatmentPlan: true }, orderBy: { createdAt: 'desc' } });
  },
  findPatientPackage(id: string) { return prisma.treatmentPackage.findUnique({ where: { id } }); },
  createProcedureSession(data: Prisma.ProcedureSessionUncheckedCreateInput, actorId?: string) {
    return prisma.$transaction(async (tx) => {
      const session = await tx.procedureSession.create({ data });
      if (session.status === 'COMPLETED' && session.treatmentPlanItemId) {
        await tx.treatmentPlanItem.update({ where: { id: session.treatmentPlanItemId }, data: { completedSessions: { increment: 1 } } });
      }
      if (session.status === 'COMPLETED' && session.packageId) {
        const treatmentPackage = await tx.treatmentPackage.findUniqueOrThrow({ where: { id: session.packageId } }); const remaining = treatmentPackage.totalSessions - treatmentPackage.completedSessions - treatmentPackage.reservedSessions;
        if (treatmentPackage.status !== 'ACTIVE' || remaining < 1) throw new Error('Active package session balance is required');
        const released = Math.min(1, treatmentPackage.reservedSessions); const updated = await tx.treatmentPackage.update({ where: { id: treatmentPackage.id }, data: { completedSessions: { increment: 1 }, reservedSessions: { decrement: released }, status: treatmentPackage.completedSessions + 1 >= treatmentPackage.totalSessions ? 'COMPLETED' : treatmentPackage.status } });
        await tx.packageSessionLedger.create({ data: { patientPackageId: updated.id, action: 'SESSION_CONSUMPTION', sessionDelta: -1, reservedDelta: -released, consumedDelta: 1, balanceRemaining: Math.max(0, updated.totalSessions - updated.completedSessions - updated.reservedSessions), procedureSessionId: session.id, effectiveAt: session.performedAt ?? new Date(), notes: `Procedure ${session.procedureName} completed`, createdById: actorId } });
      }
      return tx.procedureSession.findUniqueOrThrow({ where: { id: session.id }, include: { practitioner: { select: { id: true, name: true } }, assistant: { select: { id: true, name: true } }, room: true, device: true, treatmentPlan: true } });
    });
  },

  listPrescriptions(patientId: string) {
    return prisma.prescription.findMany({ where: { patientId }, include: { items: true, doctor: { select: { id: true, name: true } }, signedBy: { select: { id: true, name: true } } }, orderBy: { prescribedAt: 'desc' } });
  },
  findPrescription(id: string) { return prisma.prescription.findUnique({ where: { id }, include: { items: true } }); },
  getPrescriptionDocument(id: string) { return prisma.prescription.findUnique({ where: { id }, include: { items: true, patient: true, doctor: { select: { id: true, name: true } }, signedBy: { select: { id: true, name: true } } } }); },
  countPrescriptions() { return prisma.prescription.count(); },
  createPrescription(data: Prisma.PrescriptionUncheckedCreateInput) {
    return prisma.prescription.create({ data, include: { items: true, doctor: { select: { id: true, name: true } } } });
  },
  signPrescription(id: string, userId: string) {
    return prisma.prescription.update({ where: { id }, data: { status: 'SIGNED', signedById: userId, signedAt: new Date() }, include: { items: true, doctor: { select: { id: true, name: true } }, signedBy: { select: { id: true, name: true } } } });
  },

  listMedicines(search?: string) {
    return prisma.medicine.findMany({ where: { status: 'ACTIVE', name: search ? { contains: search, mode: 'insensitive' } : undefined }, orderBy: { name: 'asc' }, take: 50 });
  },
  listTemplates(branchId?: string) {
    return prisma.clinicalTemplate.findMany({ where: { active: true, OR: branchId ? [{ branchId: null }, { branchId }] : [{ branchId: null }] }, orderBy: { name: 'asc' } });
  },

  async doctorWorkspace(userId: string, branchId: string | undefined, start: Date, end: Date) {
    const appointmentWhere = { doctorId: userId, branchId, appointmentAt: { gte: start, lt: end } };
    const [appointments, incompleteNotes, plansForReview, alerts, followUpsDue, prescriptionActions, adverseEvents] = await Promise.all([
      prisma.appointment.findMany({ where: appointmentWhere, include: { lead: { include: { patient: { include: { medicalProfile: true } } } }, branch: true, service: true }, orderBy: { appointmentAt: 'asc' } }),
      prisma.clinicalEncounter.findMany({ where: { doctorId: userId, status: { in: ['DRAFT', 'COMPLETED'] } }, include: { patient: true }, orderBy: { visitDate: 'desc' }, take: 25 }),
      prisma.treatmentPlan.findMany({ where: { assignedDoctorId: userId, status: { in: ['PROPOSED', 'ACCEPTED'] }, reviewDate: { lte: end } }, include: { patient: true, items: true }, orderBy: { reviewDate: 'asc' }, take: 25 }),
      prisma.patient.findMany({ where: { assignedDoctorId: userId, medicalProfile: { criticalAlert: true } }, include: { medicalProfile: true }, take: 25 }),
      prisma.followUp.findMany({ where: { assignedUserId: userId, status: { in: ['OPEN', 'IN_PROGRESS', 'OVERDUE'] }, dueAt: { lt: end } }, include: { patient: true, person: true }, orderBy: { dueAt: 'asc' }, take: 25 }),
      prisma.prescription.findMany({ where: { doctorId: userId, status: 'DRAFT' }, include: { patient: true, items: true }, orderBy: { prescribedAt: 'desc' }, take: 25 }),
      prisma.procedureSession.findMany({ where: { practitionerId: userId, adverseEventFlag: true }, include: { patient: true }, orderBy: { createdAt: 'desc' }, take: 25 }),
    ]);
    return { appointments, incompleteNotes, plansForReview, alerts, followUpsDue, prescriptionActions, adverseEvents };
  },
};
