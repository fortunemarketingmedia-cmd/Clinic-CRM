'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { AuthGuard } from '@/modules/auth/auth-guard';
import { SessionProvider } from '@/store/session-store';
import { ApiError, DATA_CHANGED_EVENT, type DataChangeDetail } from '@/services/api';

const allOperationalQueries = [
  ['dashboard-overview'], ['analytics'], ['analytics-command-centre'], ['reports'], ['clients-analytics'],
  ['leads'], ['master-leads'], ['lead-profile'], ['lead-timeline'], ['lead-duplicates'], ['ad-leads-summary'],
  ['sales-pipeline'], ['pipeline-staff'], ['pipeline-services'], ['pipeline-resources'],
  ['appointments'], ['appointment-services'], ['appointment-resources'], ['appointment-staff'],
  ['today-queue'], ['daily-client-queue'], ['waitlist'], ['front-desk-schedules'], ['schedule-staff'], ['schedule-resources'], ['schedule-appointments'],
  ['patients'], ['clients-patients'], ['patient-360'], ['patient-sessions'], ['patient-visits'], ['patient-files'],
  ['patient-form-templates'], ['patient-form-submissions'], ['patient-consent-templates'], ['patient-consents'], ['patient-gallery'], ['secure-patient-files'],
  ['clinical-staff'], ['clinical-resources'], ['doctor-workspace'], ['follow-ups'], ['tasks'], ['task-assignees'],
];

function relatedQueries(path: string) {
  const resource = path.split('?')[0];

  if (resource.startsWith('/leads') || resource.startsWith('/ad-leads')) return allOperationalQueries;
  if (resource.startsWith('/appointments') || resource.startsWith('/waitlist') || resource.startsWith('/front-desk/')) return allOperationalQueries;
  if (resource.startsWith('/patients') || resource.startsWith('/clinical/') || resource.startsWith('/forms/') || resource.startsWith('/consents/') || resource.startsWith('/files')) return allOperationalQueries;
  if (resource.startsWith('/follow-ups') || resource.startsWith('/tasks')) return allOperationalQueries;
  if (resource.startsWith('/whatsapp')) return [['wa-conversations'], ['wa-conversation'], ['wa-templates'], ['wa-marketing-templates'], ['wa-broadcasts'], ['wa-automations'], ['wa-accounts'], ['wa-phones'], ['wa-jobs'], ['wa-failures'], ['dashboard-overview'], ['analytics'], ['analytics-command-centre']];
  if (resource.startsWith('/settings')) return [['settings'], ['dashboard-overview'], ['analytics'], ['analytics-command-centre'], ['reports']];
  if (resource.startsWith('/branches') || resource.startsWith('/users')) return [['branches'], ...allOperationalQueries];
  if (resource.startsWith('/automations')) return [['automations'], ['dashboard-overview'], ['analytics']];
  if (resource.startsWith('/lead-scoring')) return [['lead-scoring-rules'], ['leads'], ['master-leads'], ['lead-profile'], ['dashboard-overview'], ['analytics']];

  return [];
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error) =>
              error instanceof ApiError
                ? error.status >= 500 && failureCount < 2
                : failureCount < 1,
          },
          mutations: { retry: false },
        },
      }),
  );

  useEffect(() => {
    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('revive-crm-data-sync');
    const refreshRelatedQueries = (path: string) => {
      for (const queryKey of relatedQueries(path)) {
        void queryClient.invalidateQueries({ queryKey });
      }
    };
    const synchronizeConnectedViews = (event: Event) => {
      const { path } = (event as CustomEvent<DataChangeDetail>).detail;
      refreshRelatedQueries(path);
      channel?.postMessage({ path });
    };
    const synchronizeOtherTab = (event: MessageEvent<{ path?: string }>) => {
      if (event.data.path) refreshRelatedQueries(event.data.path);
    };

    window.addEventListener(DATA_CHANGED_EVENT, synchronizeConnectedViews);
    channel?.addEventListener('message', synchronizeOtherTab);
    return () => {
      window.removeEventListener(DATA_CHANGED_EVENT, synchronizeConnectedViews);
      channel?.removeEventListener('message', synchronizeOtherTab);
      channel?.close();
    };
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <AuthGuard>{children}</AuthGuard>
      </SessionProvider>
    </QueryClientProvider>
  );
}
