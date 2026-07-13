import type { Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';

export const timelineRepository = {
  listForLead(leadId: string) {
    return prisma.timelineEvent.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
    });
  },

  listForPatient(patientId: string) {
    return prisma.timelineEvent.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
    });
  },

  create(data: {
    leadId?: string;
    patientId?: string;
    type: string;
    title: string;
    description?: string;
    metadata?: Prisma.InputJsonValue;
    createdById?: string;
  }) {
    return prisma.timelineEvent.create({
      data: {
        type: data.type,
        title: data.title,
        description: data.description,
        metadata: data.metadata,
        leadId: data.leadId,
        patientId: data.patientId,
        createdById: data.createdById,
      },
    });
  },
};
