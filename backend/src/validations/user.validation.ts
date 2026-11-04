import { Role, UserStatus } from '@prisma/client';
import { z } from 'zod';

// bcrypt only uses the first 72 bytes of a password, so longer ones are rejected rather than silently truncated.
const newPassword = z.string().min(8, 'Password must be at least 8 characters').max(72, 'Password must be 72 characters or fewer')
  .regex(/[A-Za-z]/, 'Password must contain a letter').regex(/\d/, 'Password must contain a number');

export const createUserSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().toLowerCase().email(),
  password: newPassword,
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
