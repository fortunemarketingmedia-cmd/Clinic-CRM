import bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { userRepository } from '../repositories/user.repository.js';
import { HttpError } from '../utils/http-error.js';

export const userService = {
  async listUsers() {
    const users = await userRepository.list();
    return users.map((user) => ({ ...user, role: user.accessLevel }));
  },

  async createUser(input: {
    name: string;
    email: string;
    password: string;
    role: Role;
    status: 'ACTIVE' | 'INACTIVE';
    branchIds: string[];
  }) {
    const existing = await userRepository.findByEmail(input.email);

    if (existing) {
      throw new HttpError(409, 'A user with this email already exists');
    }

    const passwordHash = await bcrypt.hash(input.password, 12);

    const user = await userRepository.create({
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role,
      status: input.status,
      branchIds: input.branchIds,
    });
    return { ...user, role: user.accessLevel };
  },

  async updateUser(
    id: string,
    input: Partial<{
      name: string;
      role: Role;
      status: 'ACTIVE' | 'INACTIVE';
      branchIds: string[];
    }>,
  ) {
    const user = await userRepository.findById(id);

    if (!user) {
      throw new HttpError(404, 'User not found');
    }

    const updated = await userRepository.update(id, input);
    return { ...updated, role: updated.accessLevel };
  },

  async deleteUser(id: string) {
    const user = await userRepository.findById(id);

    if (!user) {
      throw new HttpError(404, 'User not found');
    }

    if (user.accessLevel === 'ADMIN' && user.status === 'ACTIVE') {
      const activeAdmins = await userRepository.countActiveAdmins();

      if (activeAdmins <= 1) {
        throw new HttpError(409, 'Cannot delete the last active admin');
      }
    }

    return userRepository.delete(id);
  },
};
