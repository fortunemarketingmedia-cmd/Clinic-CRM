'use client';

import { AppShell } from '@/components/layout/app-shell';
import { AuthGate } from '@/components/layout/auth-gate';
import { AppointmentsView } from '@/modules/appointments/appointments-view';

export default function AppointmentsPage() {
  return (
    <AuthGate>
      <AppShell>
        <AppointmentsView />
      </AppShell>
    </AuthGate>
  );
}
