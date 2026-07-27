import { AppShell } from '@/components/layout/app-shell';
import { AuthGate } from '@/components/layout/auth-gate';
import { DailyClientQueueView } from '@/modules/front-desk/daily-client-queue-view';

export default function DailyClientQueuePage() {
  return (
    <AuthGate>
      <AppShell>
        <DailyClientQueueView />
      </AppShell>
    </AuthGate>
  );
}
