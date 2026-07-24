'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useSessionStore } from '@/store/session-store';

const publicRoutes = ['/login'];

function isPublicRoute(pathname: string) {
  if (publicRoutes.includes(pathname)) {
    return true;
  }

  if (pathname.startsWith('/qr')) {
    return true;
  }

  return false;
}

function FullPageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-sm text-muted-foreground">Loading...</div>
    </div>
  );
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const { session, hasHydrated } = useSessionStore();
  const publicRoute = isPublicRoute(pathname);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    if (!session && !publicRoute) {
      router.replace('/login');
      return;
    }

    if (session && pathname === '/login') {
      router.replace(session.user.role === 'DEVELOPER' ? '/settings/integrations' : '/dashboard');
    }
  }, [hasHydrated, session, publicRoute, pathname, router]);

  if (!hasHydrated) {
    return <FullPageLoader />;
  }

  if (!session && !publicRoute) {
    return <FullPageLoader />;
  }

  if (session && pathname === '/login') {
    return <FullPageLoader />;
  }

  return children;
}
