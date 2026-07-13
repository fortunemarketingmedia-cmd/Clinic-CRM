import { branchRepository } from '../repositories/branch.repository.js';
import { HttpError } from '../utils/http-error.js';

export const branchService = {
  listBranches() {
    return branchRepository.list();
  },

  async updateBranch(id: string, input: { address?: string; phone?: string }) {
    const branch = await branchRepository.exists(id);
    if (!branch) throw new HttpError(404, 'Branch not found');
    return branchRepository.update(id, input);
  },
};
