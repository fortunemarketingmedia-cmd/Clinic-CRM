'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AppChromeSkeleton, Skeleton } from '@/components/ui/skeleton';
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

function FullPageLoader({ appChrome = false }: { appChrome?: boolean }) {
  if (appChrome) return <AppChromeSkeleton />;
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-surface p-5 shadow-sm">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
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
      router.replace('/dashboard');
    }
  }, [hasHydrated, session, publicRoute, pathname, router]);

  if (!hasHydrated) {
    return <FullPageLoader appChrome={!publicRoute} />;
  }

  if (!session && !publicRoute) {
    return <FullPageLoader appChrome />;
  }

  if (session && pathname === '/login') {
    return <FullPageLoader appChrome />;
  }

  return children;
}
