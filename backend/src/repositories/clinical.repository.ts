import type { FileCategory } from '@prisma/client';
import { prisma } from '../config/db.js';

export const clinicalRepository = {
  listSessions(patientId: string) {
    return prisma.session.findMany({
      where: { patientId },
      include: { package: true, files: true },
      orderBy: { visitDate: 'desc' },
    });
  },

  createSession(patientId: string, data: {
    visitDate: Date;
    doctorConsulted?: string;
    treatmentSuggested?: string;
    treatmentTaken?: string;
    medicinesPrescribed?: string;
    notes?: string;
    followupDate?: Date;
    packageId?: string;
  }) {
    return prisma.session.create({
      data: { patientId, ...data },
      include: { package: true, files: true },
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
