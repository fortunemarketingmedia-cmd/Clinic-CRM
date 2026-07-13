import { settingsRepository } from '../repositories/settings.repository.js';
import type { Prisma } from '@prisma/client';

export const settingsService = {
  getSettings() {
    return settingsRepository.getOrCreate();
  },

  updateSettings(input: Prisma.ClinicSettingsUpdateInput) {
    return settingsRepository.update(input);
  },
};
