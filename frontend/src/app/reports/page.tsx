import { AppShell } from '@/components/layout/app-shell';
import { AuthGate } from '@/components/layout/auth-gate';
import { RoleGate } from '@/components/layout/role-gate';
import { AnalyticsView } from '@/modules/analytics/analytics-view';

export default function ReportsPage() {
  return (
    <AuthGate>
      <AppShell>
        <RoleGate allowed={['ADMIN', 'RECEPTIONIST']}>
          <AnalyticsView />
        </RoleGate>
      </AppShell>
    </AuthGate>
  );
}
