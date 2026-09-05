import { branchRepository } from '../repositories/branch.repository.js';
import { HttpError } from '../utils/http-error.js';
import type { Role } from '@prisma/client';
import { cacheService } from './cache.service.js';

export const branchService = {
  async listBranches(user?: { id: string; role: Role }) {
    if (!user || user.role === 'ADMIN') {
      const cached = await cacheService.get<Awaited<ReturnType<typeof branchRepository.list>>>('branches:v1');
      if (cached) return cached;
      const branches = await branchRepository.list();
      await cacheService.set('branches:v1', branches, 600);
      return branches;
    }
    return branchRepository.listForUser(user.id);
  },

  async updateBranch(id: string, input: { address?: string; phone?: string }) {
    const branch = await branchRepository.exists(id);
    if (!branch) throw new HttpError(404, 'Branch not found');
    const updated = await branchRepository.update(id, input);
    await cacheService.delete('branches:v1');
    return updated;
  },
};
