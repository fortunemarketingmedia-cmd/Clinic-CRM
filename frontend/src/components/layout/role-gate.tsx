'use client';

import type { Role } from '@/constants/roles';
import { useSessionStore } from '@/store/session-store';

export function RoleGate({ allowed, children }: { allowed: Role[]; children: React.ReactNode }) {
  const { session } = useSessionStore();

  if (!session || !allowed.includes(session.user.role)) {
    return (
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold">Access restricted</h1>
        <p className="text-sm text-muted-foreground">This area is available only to authorized roles.</p>
      </section>
    );
  }

  return children;
}
