'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound, Lock, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { apiRequest } from '@/services/api';
import { useSessionStore } from '@/store/session-store';
import type { AuthSession } from '@/types/auth';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [pendingCredentials, setPendingCredentials] = useState<LoginFormValues | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const { setSession } = useSessionStore();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(values: LoginFormValues) {
    setError(null);

    try {
      const session = await apiRequest<AuthSession | { mfaRequired: true }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ ...values, ...(mfaRequired ? { mfaCode } : {}) }),
      });
      if ('mfaRequired' in session) {
        setPendingCredentials(values);
        setMfaRequired(true);
        return;
      }
      setSession(session);
      router.replace('/dashboard');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Login failed');
    }
  }

  return (
    <Card className="w-full max-w-md border-primary/10 shadow-xl shadow-red-950/10">
      <div className="mb-6">
        <div className="mb-5 flex h-16 items-center justify-center rounded-md border border-border bg-white p-2">
          <img
            alt="Revive Clinic"
            className="h-full w-full object-contain"
            src="/revive-logo.png"
          />
        </div>
        <h1 className="text-2xl font-semibold">Revive Clinic CRM</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to manage clinic operations.</p>
      </div>

      <form
        className="space-y-4"
        onSubmit={
          mfaRequired
            ? (event) => {
                event.preventDefault();
                if (pendingCredentials) void onSubmit(pendingCredentials);
              }
            : form.handleSubmit(onSubmit)
        }
      >
        {mfaRequired ? (
          <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
            Enter the six-digit code from your authenticator app.
          </div>
        ) : null}
        {!mfaRequired ? (
          <>
            <label className="block space-y-2">
              <span className="text-sm font-medium">Email</span>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
                <Input className="pl-9" {...form.register('email')} />
              </div>
              {form.formState.errors.email ? (
                <span className="text-xs text-red-600">{form.formState.errors.email.message}</span>
              ) : null}
            </label>
          </>
        ) : (
          <label className="block space-y-2">
            <span className="text-sm font-medium">Authenticator code</span>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
              <Input
                className="pl-9 tracking-[0.35em]"
                inputMode="numeric"
                maxLength={6}
                value={mfaCode}
                onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, ''))}
                autoFocus
              />
            </div>
          </label>
        )}

        <label className="block space-y-2">
          <span className="text-sm font-medium">Password</span>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
            <Input className="pl-9" type="password" {...form.register('password')} />
          </div>
          {form.formState.errors.password ? (
            <span className="text-xs text-red-600">{form.formState.errors.password.message}</span>
          ) : null}
        </label>

        {error ? (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        ) : null}

        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting
            ? 'Signing in...'
            : mfaRequired
              ? 'Verify and login'
              : 'Login'}
        </Button>
        {mfaRequired ? (
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => {
              setMfaRequired(false);
              setMfaCode('');
              setPendingCredentials(null);
            }}
          >
            Back to password
          </Button>
        ) : null}
      </form>
    </Card>
  );
}
