import type { Role } from '@prisma/client';
import { prisma } from '../config/db.js';

export const userRepository = {
  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },

  findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },

  countActiveAdmins() {
    return prisma.user.count({ where: { accessLevel: 'ADMIN', status: 'ACTIVE' } });
  },

  firstActiveAdmin() {
    return prisma.user.findFirst({
      where: { accessLevel: 'ADMIN', status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
    });
  },

  list() {
    return prisma.user.findMany({
      where: { accessLevel: { not: 'DEVELOPER' } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        accessLevel: true,
        status: true,
        createdAt: true,
        branchAccess: { include: { branch: true } },
      },
    });
  },

  create(data: {
    name: string;
    email: string;
    passwordHash: string;
    role: Role;
    status: 'ACTIVE' | 'INACTIVE';
    branchIds: string[];
  }) {
    return prisma.$transaction(async (tx) => {
      const { branchIds, ...userData } = data;
      const effectiveBranchIds = branchIds.length ? branchIds : (await tx.branch.findMany({ select: { id: true } })).map((branch) => branch.id);
      return tx.user.create({
        data: { ...userData, accessLevel: userData.role === 'ADMIN' ? 'ADMIN' : 'RECEPTIONIST', branchAccess: { create: effectiveBranchIds.map((branchId, index) => ({ branchId, isPrimary: index === 0 })) } },
        select: { id: true, name: true, email: true, role: true, accessLevel: true, status: true, createdAt: true, branchAccess: { include: { branch: true } } },
      });
    });
  },

  update(
    id: string,
    data: Partial<{
      name: string;
      role: Role;
      status: 'ACTIVE' | 'INACTIVE';
      branchIds: string[];
    }>,
  ) {
    return prisma.$transaction(async (tx) => {
      const { branchIds, ...userData } = data;
      const accessLevel = userData.role ? (userData.role === 'ADMIN' ? 'ADMIN' : 'RECEPTIONIST') : undefined;
      if (branchIds) {
        await tx.userBranch.deleteMany({ where: { userId: id } });
        await tx.userBranch.createMany({ data: branchIds.map((branchId, index) => ({ userId: id, branchId, isPrimary: index === 0 })) });
      }
      return tx.user.update({
      where: { id },
      data: { ...userData, accessLevel },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        accessLevel: true,
        status: true,
        createdAt: true,
        branchAccess: { include: { branch: true } },
      },
      });
    });
  },

  delete(id: string) {
    return prisma.user.delete({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });
  },
};
