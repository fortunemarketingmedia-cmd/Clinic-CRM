import { AppShell } from '@/components/layout/app-shell';
import { AuthGate } from '@/components/layout/auth-gate';
import { DailyClientQueueView } from '@/modules/front-desk/daily-client-queue-view';
import { RoleGate } from '@/components/layout/role-gate';

export default function DailyClientQueuePage() {
  return (
    <AuthGate>
      <RoleGate allowed={['ADMIN', 'RECEPTIONIST']}>
        <AppShell>
          <DailyClientQueueView />
        </AppShell>
      </RoleGate>
    </AuthGate>
  );
}
