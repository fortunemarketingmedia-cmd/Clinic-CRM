'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LoginForm } from '@/modules/auth/login-form';
import { useSessionStore } from '@/store/session-store';

export default function LoginPage() {
  const router = useRouter();
  const { session, hasHydrated } = useSessionStore();

  useEffect(() => {
    if (hasHydrated && session) {
      router.replace(session.user.role === 'DEVELOPER' ? '/settings/integrations' : '/dashboard');
    }
  }, [hasHydrated, router, session]);

  if (!hasHydrated || session) {
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

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,hsl(var(--accent)/0.18),transparent_28rem),linear-gradient(180deg,hsl(36_100%_98%),hsl(24_100%_96%))] px-4">
      <LoginForm />
    </main>
  );
}
