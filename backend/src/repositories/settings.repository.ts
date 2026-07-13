import { prisma } from '../config/db.js';
import type { Prisma } from '@prisma/client';

export const settingsRepository = {
  async getOrCreate() {
    const existing = await prisma.clinicSettings.findFirst();
    if (existing) return existing;
    return prisma.clinicSettings.create({ data: {} });
  },

  async update(data: Prisma.ClinicSettingsUpdateInput) {
    const settings = await this.getOrCreate();
    return prisma.clinicSettings.update({
      where: { id: settings.id },
      data,
    });
  },
};
