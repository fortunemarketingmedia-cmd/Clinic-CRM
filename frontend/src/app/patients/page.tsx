'use client';

import { AppShell } from '@/components/layout/app-shell';
import { AuthGate } from '@/components/layout/auth-gate';
import { PatientsView } from '@/modules/patients/patients-view';

export default function PatientsPage() {
  return (
    <AuthGate>
      <AppShell>
        <PatientsView />
      </AppShell>
    </AuthGate>
  );
}
