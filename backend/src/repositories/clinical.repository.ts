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
        if (treatmentPackage.completedSessions >= treatmentPackage.totalSessions) {
          throw new Error('All sessions in this package are already completed');
        }
      }

      const session = await tx.session.create({
        data: { patientId, ...data },
      });

      if (data.packageId) {
        await tx.treatmentPackage.update({
          where: { id: data.packageId },
          data: { completedSessions: { increment: 1 } },
        });
      }

      return tx.session.findUniqueOrThrow({
        where: { id: session.id },
        include: { package: true, files: true, appointment: { include: { branch: true } } },
      });
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
    return prisma.treatmentPackage.create({
      data: { patientId, ...data },
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
