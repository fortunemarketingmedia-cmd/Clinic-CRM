import type { Sex } from '@prisma/client';
import crypto from 'node:crypto';
import { prisma } from '../config/db.js';

type PatientInput = {
  fullName: string;
  mobile: string;
  email?: string;
  age?: number;
  sex?: Sex;
  address?: string;
  occupation?: string;
  maritalStatus?: string;
};

export const patientRepository = {
  list(filters: { branchId?: string; search?: string }) {
    return prisma.patient.findMany({
      where: {
        branchId: filters.branchId,
        OR: filters.search
          ? [
              { fullName: { contains: filters.search, mode: 'insensitive' } },
              { mobile: { contains: filters.search, mode: 'insensitive' } },
              { email: { contains: filters.search, mode: 'insensitive' } },
              { patientNo: { contains: filters.search, mode: 'insensitive' } },
            ]
          : undefined,
      },
      include: { branch: true, lead: true, medicalProfile: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  findById(id: string) {
    return prisma.patient.findUnique({
      where: { id },
      include: {
        branch: true,
        lead: true,
        medicalProfile: true,
        sessions: { orderBy: { visitDate: 'desc' } },
        packages: { orderBy: { createdAt: 'desc' } },
        invoices: { orderBy: { invoiceDate: 'desc' } },
        files: { orderBy: { createdAt: 'desc' } },
      },
    });
  },

  findByLeadId(leadId: string) {
    return prisma.patient.findUnique({ where: { leadId } });
  },

  findDuplicates(input: { mobile?: string; email?: string }) {
    return prisma.patient.findMany({
      where: {
        OR: [
          input.mobile ? { mobile: input.mobile } : undefined,
          input.email ? { email: { equals: input.email, mode: 'insensitive' } } : undefined,
        ].filter(Boolean) as Array<{ mobile: string } | { email: { equals: string; mode: 'insensitive' } }>,
      },
      include: { branch: true, lead: true, medicalProfile: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  },

  async nextPatientNo() {
    const count = await prisma.patient.count();
    return `REV-P-${String(count + 1).padStart(5, '0')}`;
  },

  createQrToken() {
    return crypto.randomBytes(24).toString('hex');
  },

  convertLead(data: PatientInput & { leadId: string; branchId: string; patientNo: string; qrToken: string }) {
    return prisma.$transaction(async (tx) => {
      const patient = await tx.patient.create({
        data,
        include: { branch: true, lead: true, medicalProfile: true },
      });

      await tx.lead.update({
        where: { id: data.leadId },
        data: { status: 'CONVERTED' },
      });

      await tx.appointment.updateMany({
        where: { leadId: data.leadId },
        data: { status: 'CONVERTED' },
      });

      return patient;
    });
  },

  convertLeadWithProfile(
    data: PatientInput & {
      leadId: string;
      branchId: string;
      patientNo: string;
      qrToken: string;
      medicalProfile: Record<string, string | undefined>;
    },
  ) {
    return prisma.$transaction(async (tx) => {
      const patient = await tx.patient.create({
        data: {
          leadId: data.leadId,
          branchId: data.branchId,
          patientNo: data.patientNo,
          qrToken: data.qrToken,
          fullName: data.fullName,
          mobile: data.mobile,
          email: data.email,
          age: data.age,
          sex: data.sex,
          address: data.address,
          occupation: data.occupation,
          maritalStatus: data.maritalStatus,
          medicalProfile: {
            create: data.medicalProfile,
          },
        },
        include: { branch: true, lead: true, medicalProfile: true },
      });

      await tx.lead.update({
        where: { id: data.leadId },
        data: { status: 'CONVERTED' },
      });

      await tx.appointment.updateMany({
        where: { leadId: data.leadId },
        data: { status: 'CONVERTED' },
      });

      return patient;
    });
  },

  createFromClinicQr(
    data: PatientInput & {
      branchId: string;
      patientNo: string;
      qrToken: string;
      medicalProfile: Record<string, string | undefined>;
    },
  ) {
    return prisma.$transaction(async (tx) => {
      const createdBy = await tx.user.findFirst({
        where: { role: 'ADMIN', status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
      });

      if (!createdBy) {
        throw new Error('No active admin user is available for QR registration intake');
      }

      const lead = await tx.lead.create({
        data: {
          qrToken: crypto.randomBytes(24).toString('hex'),
          name: data.fullName,
          mobile: data.mobile,
          email: data.email,
          address: data.address,
          source: 'WALK_IN',
          status: 'CONVERTED',
          branchId: data.branchId,
          createdById: createdBy.id,
          appointmentAt: new Date(),
          appointmentType: 'CLINIC_VISIT',
        },
      });

      return tx.patient.create({
        data: {
          leadId: lead.id,
          branchId: data.branchId,
          patientNo: data.patientNo,
          qrToken: data.qrToken,
          fullName: data.fullName,
          mobile: data.mobile,
          email: data.email,
          age: data.age,
          sex: data.sex,
          address: data.address,
          occupation: data.occupation,
          maritalStatus: data.maritalStatus,
          medicalProfile: {
            create: data.medicalProfile,
          },
        },
        include: { branch: true, lead: true, medicalProfile: true },
      });
    });
  },

  findByQrToken(qrToken: string) {
    return prisma.patient.findUnique({
      where: { qrToken },
      include: { branch: true, medicalProfile: true },
    });
  },

  submitQrProfile(
    qrToken: string,
    patientData: Partial<PatientInput>,
    medicalData: Record<string, string | undefined>,
  ) {
    return prisma.$transaction(async (tx) => {
      const patient = await tx.patient.update({
        where: { qrToken },
        data: patientData,
      });

      await tx.medicalProfile.upsert({
        where: { patientId: patient.id },
        update: medicalData,
        create: { patientId: patient.id, ...medicalData },
      });

      return tx.patient.findUniqueOrThrow({
        where: { id: patient.id },
        include: { branch: true, medicalProfile: true },
      });
    });
  },

  update(id: string, data: Partial<PatientInput>) {
    return prisma.patient.update({
      where: { id },
      data,
      include: { branch: true, lead: true, medicalProfile: true },
    });
  },

  upsertMedicalProfile(patientId: string, data: Record<string, string | undefined>) {
    return prisma.medicalProfile.upsert({
      where: { patientId },
      update: data,
      create: { patientId, ...data },
    });
  },
};
