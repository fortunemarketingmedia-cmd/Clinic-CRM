import type { Role } from '@prisma/client';
import { Role as RoleEnum } from '@prisma/client';
import { prisma } from '../config/db.js';
import { HttpError } from '../utils/http-error.js';

const globalRoles: Role[] = [RoleEnum.ADMIN];

export const accessService = {
  async assertBranchAccess(userId: string, role: Role, branchId?: string) {
    if (!branchId || globalRoles.includes(role)) return;

    const assignment = await prisma.userBranch.findUnique({
      where: { userId_branchId: { userId, branchId } },
      select: { userId: true },
    });

    if (!assignment) throw new HttpError(403, 'You do not have access to this branch');
  },
};
