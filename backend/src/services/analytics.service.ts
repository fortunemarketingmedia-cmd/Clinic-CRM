import { dashboardRepository } from '../repositories/dashboard.repository.js';
import { analyticsRepository } from '../repositories/analytics.repository.js';
import type { Role } from '@prisma/client';
import { accessService } from './access.service.js';
import { redactFinancials } from '../middleware/redact-financials.js';

export const analyticsService = {
  async overview(filters: { branchId?: string; dateFrom?: Date; dateTo?: Date }, actor: { id: string; role: Role }) {
    await accessService.assertBranchAccess(actor.id, actor.role, filters.branchId);
    return analyticsRepository.overview(filters);
  },

  async operations(filters: { branchId?: string; dateFrom?: Date; dateTo?: Date }, actor: { id: string; role: Role }) {
    await accessService.assertBranchAccess(actor.id, actor.role, filters.branchId);
    const overview = await analyticsRepository.overview(filters);
    return {
      totals: redactFinancials(overview.totals),
      byBranch: redactFinancials(overview.byBranch),
      analytics: redactFinancials(overview.analytics),
    };
  },

  /** Dashboard payload for any back-office role: the overview with every financial figure removed. */
  async dashboard(filters: { branchId?: string; dateFrom?: Date; dateTo?: Date }, actor: { id: string; role: Role }) {
    await accessService.assertBranchAccess(actor.id, actor.role, filters.branchId);
    return dashboardRepository.overview(filters);
  },
};
