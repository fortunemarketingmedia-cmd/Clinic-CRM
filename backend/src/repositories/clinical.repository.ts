import type { FileCategory, Prisma, TreatmentType } from '@prisma/client';
import { prisma } from '../config/db.js';

export const clinicalRepository = {
  listSessions(patientId: string) {
    return prisma.session.findMany({
      where: { patientId },
      include: { package: true, files: true, appointment: { include: { branch: true } } },
      orderBy: { visitDate: 'desc' },
    });
  },

  createSession(patientId: string, data: {
    appointmentId?: string;
    treatmentType: TreatmentType;
    visitDate: Date;
    doctorConsulted?: string;
    chiefComplaint?: string;
    diagnosis?: string;
    treatmentSuggested?: string;
    treatmentTaken?: string;
    medicinesPrescribed?: string;
    prescription?: Prisma.InputJsonValue;
    notes?: string;
    followupDate?: Date;
    packageId?: string;
  }) {
    return prisma.$transaction(async (tx) => {
      if (data.packageId) {
        const treatmentPackage = await tx.treatmentPackage.findFirst({
          where: { id: data.packageId, patientId },
        });
        if (!treatmentPackage) throw new Error('Treatment package not found for this patient');
        if (treatmentPackage.status !== 'ACTIVE' || treatmentPackage.completedSessions + treatmentPackage.reservedSessions >= treatmentPackage.totalSessions) {
          throw new Error('An active package with remaining sessions is required');
        }
      }

      const session = await tx.session.create({
        data: { patientId, ...data },
      });

      if (data.packageId) {
        const updated = await tx.treatmentPackage.update({
          where: { id: data.packageId },
          data: { completedSessions: { increment: 1 } },
        });
        await tx.packageSessionLedger.create({ data: { patientPackageId: updated.id, action: 'SESSION_CONSUMPTION', sessionDelta: -1, consumedDelta: 1, balanceRemaining: Math.max(0, updated.totalSessions - updated.completedSessions - updated.reservedSessions), effectiveAt: data.visitDate, notes: `Legacy session ${session.id} consumption`, metadata: { legacySessionId: session.id } } });
      }

      return tx.session.findUniqueOrThrow({
        where: { id: session.id },
        include: { package: true, files: true, appointment: { include: { branch: true } } },
      });
    });
  },

  findSession(patientId: string, sessionId: string) {
    return prisma.session.findFirst({ where: { id: sessionId, patientId }, include: { package: true, files: true } });
  },

  updateSession(patientId: string, sessionId: string, data: Partial<{
    appointmentId?: string;
    treatmentType: TreatmentType;
    visitDate: Date;
    doctorConsulted?: string;
    chiefComplaint?: string;
    diagnosis?: string;
    treatmentSuggested?: string;
    treatmentTaken?: string;
    medicinesPrescribed?: string;
    prescription?: Prisma.InputJsonValue;
    notes?: string;
    followupDate?: Date;
  }>) {
    return prisma.session.update({
      where: { id: sessionId, patientId },
      data,
      include: { package: true, files: true, appointment: { include: { branch: true } } },
    });
  },

  deleteSession(patientId: string, sessionId: string) {
    return prisma.$transaction(async (tx) => {
      const session = await tx.session.findUniqueOrThrow({ where: { id: sessionId } });
      if (session.patientId !== patientId) throw new Error('Session does not belong to this patient');
      if (session.packageId) {
        const updated = await tx.treatmentPackage.update({
          where: { id: session.packageId },
          data: {
            completedSessions: { decrement: 1 },
            status: 'ACTIVE',
          },
        });
        await tx.packageSessionLedger.create({
          data: {
            patientPackageId: updated.id,
            action: 'SESSION_REVERSAL',
            sessionDelta: 1,
            consumedDelta: -1,
            balanceRemaining: Math.max(0, updated.totalSessions - updated.completedSessions - updated.reservedSessions),
            effectiveAt: new Date(),
            notes: `Deleted legacy session ${session.id}`,
            metadata: { legacySessionId: session.id },
          },
        });
      }
      await tx.session.delete({ where: { id: sessionId } });
      return session;
    });
  },

  listPackages(patientId: string) {
    return prisma.treatmentPackage.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
    });
  },

  createPackage(patientId: string, data: {
    branchId: string;
    name: string;
    totalSessions: number;
    completedSessions: number;
    amount: number;
    paidAmount: number;
  }) {
    return prisma.$transaction(async (tx) => {
      const created = await tx.treatmentPackage.create({ data: { patientId, ...data, outstandingAmount: Math.max(0, data.amount - data.paidAmount), status: data.paidAmount > 0 ? 'ACTIVE' : 'PENDING' } });
      await tx.packageSessionLedger.create({ data: { patientPackageId: created.id, action: 'PURCHASE', sessionDelta: created.totalSessions, balanceRemaining: Math.max(0, created.totalSessions - created.completedSessions), amount: created.amount, notes: 'Legacy package creation' } });
      return created;
    });
  },

  listFiles(patientId: string) {
    return prisma.patientFile.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
    });
  },

  createFile(patientId: string, data: {
    sessionId?: string;
    invoiceId?: string;
    category: FileCategory;
    name: string;
    url: string;
    mimeType?: string;
    sizeBytes?: number;
  }) {
    return prisma.patientFile.create({
      data: { patientId, ...data },
    });
  },
};
