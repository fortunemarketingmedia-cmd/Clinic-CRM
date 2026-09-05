import { analyticsRepository } from '../repositories/analytics.repository.js';
import type { Role } from '@prisma/client';
import { accessService } from './access.service.js';

export const analyticsService = {
  async overview(filters: { branchId?: string; dateFrom?: Date; dateTo?: Date }, actor: { id: string; role: Role }) {
    await accessService.assertBranchAccess(actor.id, actor.role, filters.branchId);
    return analyticsRepository.overview(filters);
  },
};
