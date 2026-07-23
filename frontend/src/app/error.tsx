'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="flex min-h-[70vh] items-center justify-center p-6">
      <Card className="w-full max-w-lg text-center">
        <AlertTriangle className="mx-auto size-10 text-red-600" />
        <h1 className="mt-4 text-xl font-semibold">This screen could not be loaded</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your data has not been changed. Retry the screen, and contact the administrator if the
          problem continues.
        </p>
        {error.digest ? (
          <p className="mt-2 font-mono text-xs text-muted-foreground">Reference: {error.digest}</p>
        ) : null}
        <Button className="mt-5" onClick={reset}>
          <RefreshCcw className="size-4" />
          Try again
        </Button>
      </Card>
    </main>
  );
}
