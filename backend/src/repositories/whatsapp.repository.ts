import { prisma } from '../config/db.js';

export const whatsappRepository = {
  list() {
    return prisma.whatsAppLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  },

  create(data: { mobile: string; templateName: string; message: string; audience?: string }) {
    return prisma.whatsAppLog.create({ data });
  },

  async broadcast(data: { audience: 'LEADS' | 'PATIENTS' | 'ALL'; templateName: string; message: string }) {
    const [leads, patients] = await Promise.all([
      data.audience === 'LEADS' || data.audience === 'ALL'
        ? prisma.lead.findMany({ where: { status: { notIn: ['CONVERTED', 'CANCELLED'] } }, select: { mobile: true } })
        : Promise.resolve([]),
      data.audience === 'PATIENTS' || data.audience === 'ALL'
        ? prisma.patient.findMany({ select: { mobile: true } })
        : Promise.resolve([]),
    ]);

    const mobiles = Array.from(new Set([...leads, ...patients].map((record) => record.mobile).filter(Boolean)));

    if (mobiles.length === 0) {
      return [];
    }

    return prisma.whatsAppLog.createManyAndReturn({
      data: mobiles.map((mobile) => ({
        mobile,
        templateName: data.templateName,
        message: data.message,
        audience: data.audience,
      })),
    });
  },
};
