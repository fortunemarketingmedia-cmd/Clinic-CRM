export const roles = {
  admin: 'ADMIN',
  receptionist: 'RECEPTIONIST',
} as const;

export type Role = (typeof roles)[keyof typeof roles];
