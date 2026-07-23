'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { AuthGuard } from '@/modules/auth/auth-guard';
import { SessionProvider } from '@/store/session-store';
import { ApiError } from '@/services/api';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error) =>
              error instanceof ApiError
                ? error.status >= 500 && failureCount < 2
                : failureCount < 1,
          },
          mutations: { retry: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <AuthGuard>{children}</AuthGuard>
      </SessionProvider>
    </QueryClientProvider>
  );
}
