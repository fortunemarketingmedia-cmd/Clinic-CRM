import { AppShell } from '@/components/layout/app-shell';
import { AuthGate } from '@/components/layout/auth-gate';
import { RoleGate } from '@/components/layout/role-gate';
import { AnalyticsView } from '@/modules/analytics/analytics-view';

export default function FinancePage() {
  return (
    <AuthGate>
      <AppShell>
        <RoleGate allowed={['ADMIN']}>
          <AnalyticsView mode="FINANCE" />
        </RoleGate>
      </AppShell>
    </AuthGate>
  );
}
