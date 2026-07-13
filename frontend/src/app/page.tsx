'use client';

import { AppShell } from '@/components/layout/app-shell';
import { AuthGate } from '@/components/layout/auth-gate';
import { DashboardView } from '@/modules/dashboard/dashboard-view';

export default function HomePage() {
  return (
    <AuthGate>
      <AppShell>
        <DashboardView />
      </AppShell>
    </AuthGate>
  );
}

