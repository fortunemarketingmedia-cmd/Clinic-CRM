import { Role, UserStatus } from '@prisma/client';
import { z } from 'zod';

export const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum([Role.ADMIN, Role.RECEPTIONIST]).default(Role.RECEPTIONIST),
  status: z.nativeEnum(UserStatus).default(UserStatus.ACTIVE),
  branchIds: z.array(z.string().min(1)).default([]),
});

export const updateUserSchema = z
  .object({
    name: z.string().min(2).optional(),
    role: z.enum([Role.ADMIN, Role.RECEPTIONIST]).optional(),
    status: z.nativeEnum(UserStatus).optional(),
    branchIds: z.array(z.string().min(1)).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');
