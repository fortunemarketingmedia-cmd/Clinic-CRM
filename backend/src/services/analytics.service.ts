import { analyticsRepository } from '../repositories/analytics.repository.js';

export const analyticsService = {
  overview(filters?: { branchId?: string; dateFrom?: Date; dateTo?: Date }) {
    return analyticsRepository.overview(filters);
  },
};
