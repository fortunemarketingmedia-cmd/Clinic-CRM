'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { AuthGuard } from '@/modules/auth/auth-guard';
import { SessionProvider } from '@/store/session-store';
import { ApiError, DATA_CHANGED_EVENT, type DataChangeDetail } from '@/services/api';

const dashboardQueries = [['dashboard-overview'], ['analytics'], ['analytics-command-centre'], ['reports'], ['clients-analytics']];
const leadQueries = [['leads'], ['master-leads'], ['lead-profile'], ['lead-timeline'], ['lead-duplicates'], ['ad-leads-summary'], ['sales-pipeline']];
const appointmentQueries = [['appointments'], ['today-queue'], ['daily-client-queue'], ['waitlist'], ['schedule-appointments']];
const patientQueries = [['patients'], ['clients-patients'], ['patient-360'], ['patient-sessions'], ['patient-visits']];
const patientFileQueries = [['patient-files'], ['patient-gallery'], ['secure-patient-files'], ['patient-form-submissions'], ['patient-consents']];

function relatedQueries(path: string) {
  const resource = path.split('?')[0];

  if (resource.startsWith('/leads') || resource.startsWith('/ad-leads')) return [...leadQueries, ...dashboardQueries];
  if (resource.startsWith('/appointments') || resource.startsWith('/waitlist') || resource.startsWith('/front-desk/')) return [...appointmentQueries, ...leadQueries, ...dashboardQueries];
  if (resource.startsWith('/files') || resource.startsWith('/forms/') || resource.startsWith('/consents/')) return [...patientFileQueries, ['patient-360']];
  if (resource.startsWith('/patients') || resource.startsWith('/clinical/')) return [...patientQueries, ...patientFileQueries, ...appointmentQueries, ...dashboardQueries];
  if (resource.startsWith('/follow-ups') || resource.startsWith('/tasks')) return [['follow-ups'], ['tasks'], ['notification-follow-ups'], ['notification-tasks'], ['follow-up-worklist'], ['header-reminders'], ['lead-profile'], ['lead-timeline'], ['dashboard-overview']];
  if (resource.startsWith('/settings')) return [['settings'], ['dashboard-overview'], ['analytics'], ['analytics-command-centre'], ['reports']];
  if (resource.startsWith('/branches') || resource.startsWith('/users')) return [['branches'], ['appointment-staff'], ['clinical-staff'], ['schedule-staff'], ['task-assignees']];
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
            staleTime: (query) => {
              const root = String(query.queryKey[0] ?? '');
              if (['today-queue', 'daily-client-queue', 'appointments', 'schedule-appointments'].includes(root)) return 10_000;
              if (['branches', 'settings', 'appointment-services', 'appointment-resources', 'patient-form-templates', 'patient-consent-templates'].includes(root)) return 10 * 60_000;
              return 30_000;
            },
            gcTime: 15 * 60_000,
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
