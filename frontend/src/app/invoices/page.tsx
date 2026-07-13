'use client';

import { AppShell } from '@/components/layout/app-shell';
import { AuthGate } from '@/components/layout/auth-gate';
import { InvoicesView } from '@/modules/invoices/invoices-view';

export default function InvoicesPage() {
  return (
    <AuthGate>
      <AppShell>
        <InvoicesView />
      </AppShell>
    </AuthGate>
  );
}
