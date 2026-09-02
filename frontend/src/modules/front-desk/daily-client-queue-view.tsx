'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, ExternalLink, Search } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { TableSkeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/services/api';
import { useSessionStore } from '@/store/session-store';
import type { AppointmentStatus } from '@/types/appointment';
import type { QueueAppointment, QueueStage } from '@/types/front-desk';
import { PatientDirectorySearch } from '@/modules/front-desk/patient-directory-search';

const stageLabels: Record<QueueStage, string> = {
  EXPECTED: 'Expected',
  ARRIVED: 'Arrived',
  WAITING: 'Checked in',
  WITH_DOCTOR: 'In consultation',
  TREATMENT: 'In treatment',
  BILLING: 'Billing',
  COMPLETED: 'Completed',
};

function clientName(item: QueueAppointment) {
  return item.lead?.patient?.fullName ?? item.lead?.name ?? 'Unknown client';
}

function practitionerName(item: QueueAppointment) {
  return item.doctor?.name ?? item.therapist?.name ?? item.resource?.name ?? '-';
}

function serviceName(item: QueueAppointment) {
  return item.service?.name ?? item.appointmentType.replaceAll('_', ' ').toLowerCase();
}

function appointmentTime(value: string) {
  return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function localDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`));
}

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function nextAction(status: AppointmentStatus, isDoctor: boolean): { label: string; status: AppointmentStatus } | null {
  if (isDoctor && (status === 'WAITING' || status === 'IN_CONSULTATION')) return { label: 'Checkout', status: 'COMPLETED' };
  return null;
}

export function DailyClientQueueView() {
  const queryClient = useQueryClient();
  const { selectedBranchId, session } = useSessionStore();
  const isDoctor = session?.user.role === 'ADMIN';
  const [selectedDate, setSelectedDate] = useState(localDateKey(new Date()));
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState('');
  const [practitioner, setPractitioner] = useState('');
  const queueDateRange = useMemo(() => {
    const selected = startOfDay(new Date(`${selectedDate}T00:00:00`));
    const dateTo = new Date(selected);
    dateTo.setHours(23, 59, 59, 999);
    return { dateFrom: selected, dateTo };
  }, [selectedDate]);

  const queueQuery = useQuery({
    queryKey: ['daily-client-queue', selectedBranchId, queueDateRange.dateFrom.toISOString(), queueDateRange.dateTo.toISOString()],
    queryFn: () => {
      const params = new URLSearchParams({
        branchId: selectedBranchId ?? '',
        dateFrom: queueDateRange.dateFrom.toISOString(),
        dateTo: queueDateRange.dateTo.toISOString(),
      });
      return apiRequest<{ data: QueueAppointment[] }>(`/front-desk/today-queue?${params.toString()}`);
    },
    enabled: Boolean(selectedBranchId),
    refetchInterval: 20_000,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AppointmentStatus }) =>
      apiRequest(`/appointments/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['daily-client-queue'] }),
        queryClient.invalidateQueries({ queryKey: ['appointments'] }),
      ]);
    },
  });

  const allConsultancyRecords = useMemo(
    () => (queueQuery.data?.data ?? []).filter((item) => item.resourceType === 'CONSULTATION'),
    [queueQuery.data],
  );
  const records = useMemo(() => allConsultancyRecords.filter((item) => ['WAITING', 'IN_CONSULTATION'].includes(item.status)), [allConsultancyRecords]);
  const selectedDayRecords = useMemo(
    () => records.filter((item) => localDateKey(new Date(item.appointmentAt)) === selectedDate),
    [records, selectedDate],
  );
  const waitingCount = selectedDayRecords.filter((item) => item.status === 'WAITING').length;
  const inConsultationCount = selectedDayRecords.filter((item) => item.status === 'IN_CONSULTATION').length;
  const practitioners = useMemo(() => Array.from(new Set(records.map(practitionerName))).sort(), [records]);
  const filteredRecords = useMemo(() => {
    const term = search.trim().toLowerCase();
    return selectedDayRecords.filter((item) => {
      const matches =
        !term ||
        clientName(item).toLowerCase().includes(term) ||
        item.lead?.mobile?.includes(term) ||
        serviceName(item).toLowerCase().includes(term);
      return matches && (!stage || item.queueStage === stage) && (!practitioner || practitionerName(item) === practitioner);
    });
  }, [practitioner, search, selectedDayRecords, stage]);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Daily Client Queue</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Clients appear here only after reception completes check-in. Doctors can then open the clinical record and check out the client.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-muted px-3 py-1.5 text-muted-foreground">{waitingCount} waiting today</span>
          <span className="rounded-full bg-primary/10 px-3 py-1.5 text-primary">{records.length} in queue</span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <QueueMetricCard label={`Checked in on ${dateLabel(selectedDate)}`} value={selectedDayRecords.length} helper="Clients admitted by reception" />
        <QueueMetricCard label="Waiting for doctor" value={waitingCount} helper="Checked-in clients not yet in consultation" />
        <QueueMetricCard label="In consultation" value={inConsultationCount} helper="Clients currently with a doctor" />
      </div>

      {isDoctor ? (
        <PatientDirectorySearch
          branchId={selectedBranchId ?? ''}
          title="Find patient to start consultancy"
          description="The doctor can search the patient directory, open the full profile, and start the consultancy from there."
        />
      ) : null}

      <Card className="overflow-hidden p-0">
        <div className="border-b border-border p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-semibold text-foreground">Client list for {dateLabel(selectedDate)}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {filteredRecords.length} of {selectedDayRecords.length} clients
              </p>
            </div>
            <Link href="/appointments" className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-surface px-3 text-xs font-medium text-foreground hover:bg-muted">
              Calendar <ExternalLink className="size-3.5" />
            </Link>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-[180px_minmax(260px,1fr)_190px_220px]">
            <label className="relative">
              <span className="sr-only">Select queue date</span>
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Select queue date"
                className="pl-9"
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
              />
            </label>
            <label className="relative">
              <span className="sr-only">Search clients</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, mobile or service" />
            </label>
            <Select aria-label="Filter by status" value={stage} onChange={(event) => setStage(event.target.value)}><option value="">All statuses</option><option value="WAITING">Checked in</option><option value="WITH_DOCTOR">In consultation</option></Select>
            <Select aria-label="Filter by practitioner" value={practitioner} onChange={(event) => setPractitioner(event.target.value)}>
              <option value="">All practitioners</option>
              {practitioners.map((name) => <option key={name} value={name}>{name}</option>)}
            </Select>
          </div>
        </div>

        {queueQuery.isLoading ? (
          <TableSkeleton rows={6} columns={6} />
        ) : filteredRecords.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            {selectedDayRecords.length ? 'No clients match the selected filters.' : 'No consultancy clients are currently in the queue.'}
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Time</th>
                    <th className="px-4 py-3 font-medium">Client</th>
                    <th className="px-4 py-3 font-medium">Service</th>
                    <th className="px-4 py-3 font-medium">Practitioner</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredRecords.map((item, index) => (
                    <QueueRow
                      key={item.id}
                      appointment={item}
                      queueNumber={index + 1}
                      isDoctor={isDoctor}
                      saving={updateStatus.isPending && updateStatus.variables?.id === item.id}
                      onUpdate={(status) => updateStatus.mutate({ id: item.id, status })}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-border md:hidden">
              {filteredRecords.map((item, index) => (
                <QueueMobileCard
                  key={item.id}
                  appointment={item}
                  queueNumber={index + 1}
                  isDoctor={isDoctor}
                  saving={updateStatus.isPending && updateStatus.variables?.id === item.id}
                  onUpdate={(status) => updateStatus.mutate({ id: item.id, status })}
                />
              ))}
            </div>
          </>
        )}
      </Card>
    </section>
  );
}

function QueueMetricCard({ label, value, helper }: { label: string; value: number; helper: string }) {
  return (
    <Card className="p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
    </Card>
  );
}

function QueueRow({ appointment, queueNumber, isDoctor, saving, onUpdate }: {
  appointment: QueueAppointment;
  queueNumber: number;
  isDoctor: boolean;
  saving: boolean;
  onUpdate: (status: AppointmentStatus) => void;
}) {
  const action = nextAction(appointment.status, isDoctor);
  return (
    <tr className="transition hover:bg-muted/30">
      <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground"><span className="mr-2 inline-grid size-7 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{queueNumber}</span>{appointmentTime(appointment.appointmentAt)}</td>
      <td className="px-4 py-3">
        <span className="font-medium text-foreground">{clientName(appointment)}</span>
        <p className="text-xs text-muted-foreground">{appointment.lead?.mobile ?? 'No mobile'}</p>
      </td>
      <td className="px-4 py-3 capitalize text-muted-foreground">{serviceName(appointment)}</td>
      <td className="px-4 py-3 text-muted-foreground">{practitionerName(appointment)}</td>
      <td className="px-4 py-3"><StatusBadge stage={appointment.queueStage} /></td>
      <td className="px-4 py-3 text-right">
        {action ? (
          <Button variant={action.status === 'COMPLETED' ? 'primary' : 'secondary'} className="h-8 px-3 text-xs" disabled={saving} onClick={() => onUpdate(action.status)}>
            {saving ? 'Updating...' : action.label}
          </Button>
        ) : <span className="text-xs text-muted-foreground">-</span>}
      </td>
    </tr>
  );
}

function QueueMobileCard({ appointment, queueNumber, isDoctor, saving, onUpdate }: {
  appointment: QueueAppointment;
  queueNumber: number;
  isDoctor: boolean;
  saving: boolean;
  onUpdate: (status: AppointmentStatus) => void;
}) {
  const action = nextAction(appointment.status, isDoctor);
  return (
    <article className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium text-foreground"><span className="mr-2 inline-grid size-6 place-items-center rounded-full bg-primary/10 text-xs text-primary">{queueNumber}</span>{clientName(appointment)}</div>
          <p className="mt-0.5 text-xs capitalize text-muted-foreground">{appointmentTime(appointment.appointmentAt)} - {serviceName(appointment)}</p>
        </div>
        <StatusBadge stage={appointment.queueStage} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{practitionerName(appointment)}</p>
      {action && (
        <Button variant={action.status === 'COMPLETED' ? 'primary' : 'secondary'} className="mt-3 h-8 w-full text-xs" disabled={saving} onClick={() => onUpdate(action.status)}>
          {saving ? 'Updating...' : action.label}
        </Button>
      )}
    </article>
  );
}

function StatusBadge({ stage }: { stage: QueueStage }) {
  const live = stage === 'WITH_DOCTOR' || stage === 'TREATMENT';
  const done = stage === 'COMPLETED';
  return (
    <span className={cn(
      'inline-flex whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-medium',
      live ? 'bg-primary/10 text-primary' : done ? 'bg-emerald-50 text-emerald-700' : 'bg-muted text-muted-foreground',
    )}>
      {stageLabels[stage]}
    </span>
  );
}
