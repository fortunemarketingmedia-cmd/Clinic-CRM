'use client';

import { AppShell } from '@/components/layout/app-shell';
import { AuthGate } from '@/components/layout/auth-gate';
import { RoleGate } from '@/components/layout/role-gate';
import { SettingsView } from '@/modules/settings/settings-view';

export default function SettingsPage() {
  return (
    <AuthGate>
      <AppShell>
        <RoleGate allowed={['ADMIN']}>
          <SettingsView />
        </RoleGate>
      </AppShell>
    </AuthGate>
  );
}
