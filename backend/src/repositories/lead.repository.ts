import type { AppointmentType, EnquirySource, LeadPriority, LeadStatus, Role } from '@prisma/client';
import crypto from 'node:crypto';
import { prisma } from '../config/db.js';

type LeadFilters = {
  branchId?: string;
  status?: LeadStatus;
  source?: EnquirySource;
  search?: string;
  role: Role;
};

export const leadRepository = {
  createQrToken() {
    return crypto.randomBytes(24).toString('hex');
  },

  list(filters: LeadFilters) {
    return prisma.lead.findMany({
      where: {
        branchId: filters.branchId,
        source: filters.source,
        status: filters.status ?? { not: 'CONVERTED' },
        OR: filters.search
          ? [
              { name: { contains: filters.search, mode: 'insensitive' } },
              { mobile: { contains: filters.search, mode: 'insensitive' } },
              { email: { contains: filters.search, mode: 'insensitive' } },
            ]
          : undefined,
      },
      include: { branch: true, adLeads: true, patient: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  findById(id: string) {
    return prisma.lead.findUnique({ where: { id }, include: { branch: true, adLeads: true, patient: true } });
  },

  findOpenByMobile(mobile: string) {
    return prisma.lead.findFirst({
      where: { mobile, status: { notIn: ['CONVERTED', 'CANCELLED'] } },
      include: { branch: true, adLeads: true, patient: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  findDuplicates(input: { mobile?: string; email?: string }) {
    return prisma.$transaction(async (tx) => {
      const [leads, patients] = await Promise.all([
        tx.lead.findMany({
          where: {
            OR: [
              input.mobile ? { mobile: input.mobile } : undefined,
              input.email ? { email: { equals: input.email, mode: 'insensitive' } } : undefined,
            ].filter(Boolean) as Array<{ mobile: string } | { email: { equals: string; mode: 'insensitive' } }>,
          },
          include: { branch: true, patient: true, adLeads: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
        tx.patient.findMany({
          where: {
            OR: [
              input.mobile ? { mobile: input.mobile } : undefined,
              input.email ? { email: { equals: input.email, mode: 'insensitive' } } : undefined,
            ].filter(Boolean) as Array<{ mobile: string } | { email: { equals: string; mode: 'insensitive' } }>,
          },
          include: { branch: true, lead: true, medicalProfile: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
      ]);

      return { leads, patients };
    });
  },

  findByQrToken(qrToken: string) {
    return prisma.lead.findUnique({ where: { qrToken }, include: { branch: true, patient: true } });
  },

  create(data: {
    name: string;
    mobile: string;
    email?: string;
    address?: string;
    source: EnquirySource;
    priority?: LeadPriority;
    nextFollowupAt?: Date;
    lastContactedAt?: Date;
    followupNotes?: string;
    interestedTreatment?: string;
    branchId: string;
    createdById: string;
    appointmentType: AppointmentType;
    appointmentAt?: Date;
    qrToken: string;
  }) {
    return prisma.lead.create({ data, include: { branch: true, adLeads: true, patient: true } });
  },

  update(
    id: string,
    data: Partial<{
      name: string;
      mobile: string;
      email: string;
      address: string;
      source: EnquirySource;
      priority: LeadPriority;
      nextFollowupAt: Date;
      lastContactedAt: Date;
      followupNotes: string;
      interestedTreatment: string;
      branchId: string;
      appointmentType: AppointmentType;
      appointmentAt: Date;
      status: LeadStatus;
    }>,
  ) {
    return prisma.$transaction(async (tx) => {
      const lead = await tx.lead.update({ where: { id }, data, include: { branch: true, adLeads: true, patient: true } });

      if (lead.status === 'CONFIRMED' && lead.appointmentAt) {
        const existingAppointment = await tx.appointment.findFirst({ where: { leadId: lead.id } });

        if (existingAppointment) {
          await tx.appointment.update({
            where: { id: existingAppointment.id },
            data: {
              branchId: lead.branchId,
              appointmentAt: lead.appointmentAt,
              appointmentType: lead.appointmentType,
              status: 'CONFIRMED',
            },
          });
        } else {
          await tx.appointment.create({
            data: {
              leadId: lead.id,
              branchId: lead.branchId,
              appointmentAt: lead.appointmentAt,
              appointmentType: lead.appointmentType,
              status: 'CONFIRMED',
            },
          });
        }
      }

      return lead;
    });
  },

  delete(id: string) {
    return prisma.lead.delete({ where: { id } });
  },
};
