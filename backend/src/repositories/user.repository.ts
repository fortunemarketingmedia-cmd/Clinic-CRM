import { prisma } from '../config/db.js';

export const userRepository = {
  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },

  findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },

  countActiveAdmins() {
    return prisma.user.count({ where: { role: 'ADMIN', status: 'ACTIVE' } });
  },

  firstActiveAdmin() {
    return prisma.user.findFirst({
      where: { role: 'ADMIN', status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
    });
  },

  list() {
    return prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
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

  create(data: {
    name: string;
    email: string;
    passwordHash: string;
    role: 'ADMIN' | 'RECEPTIONIST';
    status: 'ACTIVE' | 'INACTIVE';
  }) {
    return prisma.user.create({
      data,
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

  update(
    id: string,
    data: Partial<{
      name: string;
      role: 'ADMIN' | 'RECEPTIONIST';
      status: 'ACTIVE' | 'INACTIVE';
    }>,
  ) {
    return prisma.user.update({
      where: { id },
      data,
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
