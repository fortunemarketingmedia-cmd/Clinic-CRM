import bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { forgetUserAccess } from '../middleware/auth.js';
import { refreshTokenRepository } from '../repositories/refresh-token.repository.js';
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
    const email = input.email.trim().toLowerCase();
    const existing = await userRepository.findByEmail(email);

    if (existing) {
      throw new HttpError(409, 'A user with this email already exists');
    }

    const passwordHash = await bcrypt.hash(input.password, 12);

    const user = await userRepository.create({
      name: input.name,
      email,
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

    const losesAdmin = user.accessLevel === 'ADMIN' && user.status === 'ACTIVE' && ((input.role && input.role !== Role.ADMIN) || (input.status && input.status !== 'ACTIVE'));
    if (losesAdmin && (await userRepository.countActiveAdmins()) <= 1) {
      throw new HttpError(409, 'Cannot demote or deactivate the last active admin');
    }

    const updated = await userRepository.update(id, input);
    // Signed-in sessions must not keep the old access level or survive deactivation.
    if ((input.status && input.status !== user.status) || (input.role && input.role !== user.accessLevel) || input.branchIds) {
      forgetUserAccess(id);
      if ((input.status && input.status !== 'ACTIVE') || (input.role && input.role !== user.accessLevel)) await refreshTokenRepository.revokeAllForUser(id);
    }
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

    await refreshTokenRepository.revokeAllForUser(id);
    forgetUserAccess(id);
    return userRepository.delete(id);
  },
};
