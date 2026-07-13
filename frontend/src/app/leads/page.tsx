import { AppShell } from '@/components/layout/app-shell';
import { AuthGate } from '@/components/layout/auth-gate';
import { LeadsView } from '@/modules/leads/leads-view';

export default function LeadsPage() {
  return (
    <AuthGate>
      <AppShell>
        <LeadsView />
      </AppShell>
    </AuthGate>
  );
}
