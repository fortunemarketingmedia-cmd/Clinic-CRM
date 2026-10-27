import { prisma } from '../config/db.js';

export const branchRepository = {
  list() {
    return prisma.branch.findMany({ orderBy: { name: 'asc' } });
  },

  listForUser(userId: string) {
    return prisma.branch.findMany({ where: { userAccess: { some: { userId } } }, orderBy: { name: 'asc' } });
  },

  exists(id: string) {
    return prisma.branch.findUnique({ where: { id }, select: { id: true } });
  },

  first() {
    return prisma.branch.findFirst({ orderBy: { name: 'asc' } });
  },

  findByName(name: string) {
    return prisma.branch.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } });
  },

  update(id: string, data: { address?: string; phone?: string }) {
    return prisma.branch.update({ where: { id }, data });
  },
};
