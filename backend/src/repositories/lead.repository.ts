import type { AppointmentType, EnquirySource, LeadPriority, LeadStatus, Prisma, Role } from '@prisma/client';
import crypto from 'node:crypto';
import { prisma } from '../config/db.js';

type LeadFilters = {
  branchId?: string;
  status?: LeadStatus;
  source?: EnquirySource;
  search?: string;
  createdFrom?: Date;
  createdTo?: Date;
  includeClosed?: boolean;
  view?: 'ACTIVE' | 'ARCHIVED' | 'MANUAL';
  archiveOutcome?: 'WON' | 'LOST';
  ownerId?: string;
  interestedTreatment?: string;
  lostReason?: string;
  closedFrom?: Date;
  closedTo?: Date;
  role: Role;
  page: number;
  pageSize: number;
};

const clientPipelineStatuses: LeadStatus[] = [
  'APPOINTMENT_BOOKED',
  'BOOKED',
  'CONFIRMED',
  'ARRIVED',
  'CONVERTED',
];

export const leadRepository = {
  createQrToken() {
    return crypto.randomBytes(24).toString('hex');
  },

  async list(filters: LeadFilters) {
    const archivedStatuses: LeadStatus[] = ['APPOINTMENT_BOOKED', 'BOOKED', 'CONFIRMED', 'CONVERTED', 'LOST', 'DISQUALIFIED'];
    const archiveStatusFilter = filters.archiveOutcome === 'WON' ? { in: archivedStatuses.slice(0, 4) } : filters.archiveOutcome === 'LOST' ? { in: archivedStatuses.slice(4) } : { in: archivedStatuses };
    const closedRange = { gte: filters.closedFrom, lte: filters.closedTo };
    const where: Prisma.LeadWhereInput = {
        branchId: filters.branchId,
        source: filters.source ?? (filters.view === 'MANUAL' ? { notIn: ['GOOGLE_ADS', 'META_ADS'] } : undefined),
        status: filters.status ?? (filters.view === 'ARCHIVED' ? archiveStatusFilter : filters.view === 'ACTIVE' || filters.view === 'MANUAL' ? { notIn: archivedStatuses } : filters.includeClosed ? undefined : { notIn: clientPipelineStatuses }),
        ownerId: filters.ownerId,
        interestedTreatment: filters.interestedTreatment ? { contains: filters.interestedTreatment, mode: 'insensitive' } : undefined,
        lostReason: filters.lostReason ? { contains: filters.lostReason, mode: 'insensitive' } : undefined,
        AND: filters.closedFrom || filters.closedTo ? [{ OR: [{ closedAt: closedRange }, { closedAt: null, convertedAt: closedRange }, { closedAt: null, convertedAt: null, updatedAt: closedRange }] }] : undefined,
        createdAt: filters.createdFrom || filters.createdTo
          ? {
              gte: filters.createdFrom,
              lte: filters.createdTo,
            }
          : undefined,
        OR: filters.search
          ? [
              { name: { contains: filters.search, mode: 'insensitive' } },
              { mobile: { contains: filters.search, mode: 'insensitive' } },
              { email: { contains: filters.search, mode: 'insensitive' } },
            ]
          : undefined,
      };
    const [items, total] = await prisma.$transaction([
      prisma.lead.findMany({ where, select: { id: true, qrToken: true, name: true, mobile: true, email: true, address: true, source: true, status: true, priority: true, nextFollowupAt: true, lastContactedAt: true, followupNotes: true, interestedTreatment: true, appointmentType: true, appointmentAt: true, convertedAt: true, closedAt: true, branchId: true, personId: true, ownerId: true, nextAction: true, nextActionDueAt: true, qualificationStatus: true, qualificationNotes: true, leadScore: true, scoreCategory: true, lostReason: true, lostNotes: true, disqualificationReason: true, createdAt: true, updatedAt: true, branch: true, patient: true, person: true, owner: { select: { id: true, name: true } }, adLeads: { select: { id: true, platform: true, campaignName: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      }),
      prisma.lead.count({ where }),
    ]);
    return { items, total, page: filters.page, pageSize: filters.pageSize };
  },

  findById(id: string) {
    return prisma.lead.findUnique({ where: { id }, include: { branch: true, adLeads: true, patient: true, person: { include: { patient: true } }, owner: { select: { id: true, name: true } }, appointments: { include: { service: true, doctor: { select: { id: true, name: true } }, resource: true }, orderBy: { appointmentAt: 'desc' } }, followUps: { include: { assignedUser: { select: { id: true, name: true } } }, orderBy: { dueAt: 'desc' } }, tasks: { include: { assignedUser: { select: { id: true, name: true } } }, orderBy: { dueAt: 'desc' } }, callLogs: { orderBy: { startedAt: 'desc' } }, scoreHistory: { orderBy: { createdAt: 'desc' } } } });
  },

  findOpenByMobile(mobile: string) {
    return prisma.lead.findFirst({
      where: { mobile, status: { notIn: ['CONVERTED', 'CANCELLED'] } },
      include: { branch: true, adLeads: true, patient: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  findDuplicates(input: { mobile?: string; email?: string; branchId?: string }) {
    return prisma.$transaction(async (tx) => {
      const [leads, patients] = await Promise.all([
        tx.lead.findMany({
          where: {
            branchId: input.branchId,
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
            branchId: input.branchId,
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
    personId: string;
    ownerId: string;
    nextAction: string;
    nextActionDueAt: Date;
  }) {
    return prisma.lead.create({ data: { ...data, status: 'ASSIGNED' }, include: { branch: true, adLeads: true, patient: true, person: true, owner: { select: { id: true, name: true } } } });
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
      ownerId: string;
      nextAction: string;
      nextActionDueAt: Date;
      qualificationStatus: string;
      qualificationNotes: string;
      leadScore: number;
      lostReason: string;
      lostNotes: string;
      disqualificationReason: string;
      convertedAt: Date;
    }>,
  ) {
    return prisma.$transaction(async (tx) => {
      const lead = await tx.lead.update({ where: { id }, data, include: { branch: true, adLeads: true, patient: true, person: true, owner: { select: { id: true, name: true } } } });

      if ((lead.status === 'APPOINTMENT_BOOKED' || lead.status === 'CONFIRMED') && lead.appointmentAt) {
        const existingAppointment = await tx.appointment.findFirst({ where: { leadId: lead.id } });

        if (existingAppointment) {
          await tx.appointment.update({
            where: { id: existingAppointment.id },
            data: {
              branchId: lead.branchId,
              appointmentAt: lead.appointmentAt,
              appointmentType: lead.appointmentType,
              status: 'SCHEDULED',
            },
          });
        } else {
          await tx.appointment.create({
            data: {
              leadId: lead.id,
              branchId: lead.branchId,
              appointmentAt: lead.appointmentAt,
              appointmentType: lead.appointmentType,
              status: 'SCHEDULED',
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
