import Link from 'next/link';
import { Card } from '@/components/ui/card';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md text-center">
        <p className="text-sm font-semibold text-primary">404</p>
        <h1 className="mt-2 text-2xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The requested CRM screen does not exist or has been removed.
        </p>
        <Link
          className="mt-5 inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          href="/dashboard"
        >
          Return to dashboard
        </Link>
      </Card>
    </main>
  );
}
