import type { Role } from '@/constants/roles';

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: 'ACTIVE' | 'INACTIVE';
};

export type AuthSession = {
  user: User;
  accessToken: string;
};
