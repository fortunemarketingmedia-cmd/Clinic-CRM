import type { Role } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      correlationId: string;
      rawBody?: Buffer;
      user?: {
        id: string;
        role: Role;
      };
    }
  }
}
