'use client';

import { LoginForm } from '@/modules/auth/login-form';
import { AppChromeSkeleton } from '@/components/ui/skeleton';
import { useSessionStore } from '@/store/session-store';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, hasHydrated } = useSessionStore();

  if (!hasHydrated) {
    return <AppChromeSkeleton />;
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <LoginForm />
      </main>
    );
  }

  return children;
}
