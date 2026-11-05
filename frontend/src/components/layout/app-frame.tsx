'use client';

import { usePathname } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { AuthGate } from '@/components/layout/auth-gate';
import { isPublicAppRoute } from '@/lib/public-routes';

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (isPublicAppRoute(pathname)) return children;

  return (
    <AuthGate>
      <AppShell>{children}</AppShell>
    </AuthGate>
  );
}
