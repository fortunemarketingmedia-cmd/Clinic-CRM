'use client';

import { AppShell } from '@/components/layout/app-shell';
import { AuthGate } from '@/components/layout/auth-gate';
import { AppointmentsView } from '@/modules/appointments/appointments-view';
import { RoleGate } from '@/components/layout/role-gate';

export default function AppointmentsPage() {
  return (
    <AuthGate>
      <RoleGate allowed={['ADMIN', 'RECEPTIONIST']}>
        <AppShell>
          <AppointmentsView />
        </AppShell>
      </RoleGate>
    </AuthGate>
  );
}
