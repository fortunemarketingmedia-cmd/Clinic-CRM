import { AppShell } from '@/components/layout/app-shell';
import { AuthGate } from '@/components/layout/auth-gate';
import { RoleGate } from '@/components/layout/role-gate';
import { ClientsView } from '@/modules/clients/clients-view';

export default function ClientsPage() {
  return (
    <AuthGate>
      <RoleGate allowed={['ADMIN', 'RECEPTIONIST']}>
        <AppShell>
          <ClientsView />
        </AppShell>
      </RoleGate>
    </AuthGate>
  );
}
