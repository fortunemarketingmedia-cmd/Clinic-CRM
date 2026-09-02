import { branchRepository } from '../repositories/branch.repository.js';
import { HttpError } from '../utils/http-error.js';
import type { Role } from '@prisma/client';

export const branchService = {
  listBranches(user?: { id: string; role: Role }) {
    if (!user || user.role === 'ADMIN') return branchRepository.list();
    return branchRepository.listForUser(user.id);
  },

  async updateBranch(id: string, input: { address?: string; phone?: string }) {
    const branch = await branchRepository.exists(id);
    if (!branch) throw new HttpError(404, 'Branch not found');
    return branchRepository.update(id, input);
  },
};
