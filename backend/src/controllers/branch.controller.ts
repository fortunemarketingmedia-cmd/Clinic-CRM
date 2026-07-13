import type { Request, Response } from 'express';
import { z } from 'zod';
import { branchService } from '../services/branch.service.js';

const updateBranchSchema = z.object({
  address: z.string().optional(),
  phone: z.string().optional(),
});

export const branchController = {
  async list(_req: Request, res: Response) {
    const branches = await branchService.listBranches();
    return res.json({ data: branches });
  },

  async update(req: Request, res: Response) {
    const input = updateBranchSchema.parse(req.body);
    const branch = await branchService.updateBranch(req.params.id, input);
    return res.json({ data: branch });
  },
};
