import { settingsRepository } from '../repositories/settings.repository.js';
import type { Prisma } from '@prisma/client';
import { cacheService } from './cache.service.js';

export const settingsService = {
  async getSettings() {
    const cached = await cacheService.get<Awaited<ReturnType<typeof settingsRepository.getOrCreate>>>('settings:v1');
    if (cached) return cached;
    const settings = await settingsRepository.getOrCreate();
    await cacheService.set('settings:v1', settings, 600);
    return settings;
  },

  async updateSettings(input: Prisma.ClinicSettingsUpdateInput) {
    const settings = await settingsRepository.update(input);
    await cacheService.delete('settings:v1');
    return settings;
  },
};
