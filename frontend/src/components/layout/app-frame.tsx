'use client';

import { usePathname } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { AuthGate } from '@/components/layout/auth-gate';

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublicRoute = pathname === '/login' || pathname.startsWith('/qr/');

  if (isPublicRoute) return children;

  return (
    <AuthGate>
      <AppShell>{children}</AppShell>
    </AuthGate>
  );
}
