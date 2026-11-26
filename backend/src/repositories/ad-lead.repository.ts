import type { AdPlatform, Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';
import { normalizeSearchTerm, textSearchVariants } from '../utils/search.js';

export type AdLeadInput = {
  platform: AdPlatform;
  externalLeadId?: string;
  name: string;
  mobile: string;
  email?: string;
  campaignId?: string;
  campaignName?: string;
  adSetId?: string;
  adSetName?: string;
  adId?: string;
  adName?: string;
  formId?: string;
  formName?: string;
  branchId?: string;
  leadId?: string;
  rawPayload?: Prisma.InputJsonValue;
};

export const adLeadRepository = {
  list(filters: { platform?: AdPlatform; branchId?: string; search?: string }) {
    const search = normalizeSearchTerm(filters.search);
    const textVariants = textSearchVariants(search);
    return prisma.adLead.findMany({
      where: {
        platform: filters.platform,
        branchId: filters.branchId,
        OR: search
          ? [
              ...textVariants.map((filter) => ({ name: filter })),
              { mobile: { contains: search, mode: 'insensitive' } },
              ...textVariants.map((filter) => ({ campaignName: filter })),
              ...textVariants.map((filter) => ({ adName: filter })),
            ]
          : undefined,
      },
      include: { branch: true, lead: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  create(data: AdLeadInput) {
    return prisma.adLead.create({
      data,
      include: { branch: true, lead: true },
    });
  },

  findById(id: string) {
    return prisma.adLead.findUnique({ where: { id }, include: { branch: true, lead: true } });
  },

  linkLead(id: string, leadId: string) {
    return prisma.adLead.update({
      where: { id },
      data: { leadId },
      include: { branch: true, lead: true },
    });
  },

  stats(filters: { branchId?: string } = {}) {
    return prisma.adLead.groupBy({
      by: ['platform'],
      where: {
        branchId: filters.branchId,
      },
      _count: { id: true },
    });
  },
};
