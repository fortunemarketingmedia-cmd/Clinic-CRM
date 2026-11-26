import type { PersonRecordStatus, PreferredChannel, Prisma, Sex } from '@prisma/client';
import { prisma } from '../config/db.js';
import { normalizeSearchTerm, textSearchVariants } from '../utils/search.js';

export type PersonInput = {
  fullName: string;
  primaryMobile: string;
  normalizedMobile: string;
  alternateMobile?: string;
  normalizedAlternateMobile?: string;
  email?: string;
  normalizedEmail?: string;
  dateOfBirth?: Date;
  sex?: Sex;
  address?: string;
  city?: string;
  state?: string;
  pinCode?: string;
  emergencyContactName?: string;
  emergencyContactMobile?: string;
  guardianName?: string;
  guardianMobile?: string;
  guardianRelationship?: string;
  preferredLanguage?: string;
  preferredChannel?: PreferredChannel;
  preferredBranchId?: string;
  marketingConsent?: boolean;
  transactionalConsent?: boolean;
  appointmentNotificationConsent?: boolean;
  dataProcessingConsent?: boolean;
};

function branchScope(branchIds?: string[]): Prisma.PersonWhereInput {
  if (!branchIds) return {};
  return { OR: [
    { preferredBranchId: { in: branchIds } },
    { leads: { some: { branchId: { in: branchIds }, deletedAt: null } } },
    { patient: { is: { branchId: { in: branchIds }, deletedAt: null } } },
  ] };
}

export const personRepository = {
  list(filters: { search?: string; status?: PersonRecordStatus; take: number; branchIds?: string[] }) {
    const search = normalizeSearchTerm(filters.search);
    const textVariants = textSearchVariants(search);
    return prisma.person.findMany({
      where: {
        AND: [branchScope(filters.branchIds)],
        recordStatus: filters.status,
        OR: search
          ? [
              ...textVariants.map((filter) => ({ fullName: filter })),
              { primaryMobile: { contains: search } },
              { email: { contains: search, mode: 'insensitive' } },
            ]
          : undefined,
      },
      include: { preferredBranch: true, patient: { where: { branchId: filters.branchIds ? { in: filters.branchIds } : undefined, deletedAt: null } }, _count: { select: { leads: { where: { deletedAt: null, branchId: filters.branchIds ? { in: filters.branchIds } : undefined } } } } },
      orderBy: search ? [{ fullName: 'asc' }, { updatedAt: 'desc' }] : { updatedAt: 'desc' },
      take: filters.take,
    });
  },

  findById(id: string, branchIds?: string[]) {
    return prisma.person.findUnique({
      where: { id, AND: [branchScope(branchIds)] },
      include: {
        preferredBranch: true,
        leads: { where: { deletedAt: null, branchId: branchIds ? { in: branchIds } : undefined }, include: { branch: true, owner: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } },
        patient: { where: { branchId: branchIds ? { in: branchIds } : undefined, deletedAt: null }, include: { branch: true } },
      },
    });
  },

  findExact(input: { normalizedMobile?: string; normalizedEmail?: string; branchIds?: string[] }) {
    return prisma.person.findFirst({
      where: {
        AND: [branchScope(input.branchIds)],
        recordStatus: { not: 'MERGED' },
        OR: [
          input.normalizedMobile ? { normalizedMobile: input.normalizedMobile } : undefined,
          input.normalizedMobile ? { normalizedAlternateMobile: input.normalizedMobile } : undefined,
          input.normalizedEmail ? { normalizedEmail: input.normalizedEmail } : undefined,
        ].filter(Boolean) as Prisma.PersonWhereInput[],
      },
      orderBy: { createdAt: 'asc' },
    });
  },

  create(data: PersonInput) {
    return prisma.person.create({ data });
  },

  update(id: string, data: Partial<PersonInput>) {
    return prisma.person.update({ where: { id }, data });
  },

  async merge(primaryId: string, duplicateId: string) {
    return prisma.$transaction(async (tx) => {
      const [primary, duplicate] = await Promise.all([
        tx.person.findUnique({ where: { id: primaryId }, include: { patient: true } }),
        tx.person.findUnique({ where: { id: duplicateId }, include: { patient: true } }),
      ]);
      if (!primary || !duplicate) return null;
      if (primary.patient && duplicate.patient) return { conflict: true as const, primary, duplicate };

      await Promise.all([
        tx.lead.updateMany({ where: { personId: duplicateId }, data: { personId: primaryId } }),
        tx.followUp.updateMany({ where: { personId: duplicateId }, data: { personId: primaryId } }),
        tx.task.updateMany({ where: { personId: duplicateId }, data: { personId: primaryId } }),
        tx.callLog.updateMany({ where: { personId: duplicateId }, data: { personId: primaryId } }),
        tx.timelineEvent.updateMany({ where: { personId: duplicateId }, data: { personId: primaryId } }),
      ]);
      if (!primary.patient && duplicate.patient) {
        await tx.patient.update({ where: { id: duplicate.patient.id }, data: { personId: primaryId } });
      }
      await tx.person.update({ where: { id: duplicateId }, data: { recordStatus: 'MERGED', mergedIntoId: primaryId } });
      return { conflict: false as const, primary, duplicate };
    });
  },
};
