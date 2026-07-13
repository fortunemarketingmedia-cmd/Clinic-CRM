'use client';

import { LoginForm } from '@/modules/auth/login-form';
import { useSessionStore } from '@/store/session-store';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, hasHydrated } = useSessionStore();

  if (!hasHydrated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-5 shadow-sm">
          <div className="h-5 w-36 rounded bg-muted" />
          <div className="mt-4 h-10 rounded bg-muted" />
          <div className="mt-3 h-10 rounded bg-muted" />
          <div className="mt-4 h-10 rounded bg-muted" />
        </div>
      </main>
    );
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
