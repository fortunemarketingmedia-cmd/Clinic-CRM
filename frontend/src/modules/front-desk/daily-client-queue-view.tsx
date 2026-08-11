'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CalendarDays, CheckCircle2, Clock3, ExternalLink, Search, Stethoscope, UserRound, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton, TableSkeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/services/api';
import { useSessionStore } from '@/store/session-store';
import type { AppointmentStatus } from '@/types/appointment';
import type { QueueAppointment, QueueStage } from '@/types/front-desk';

const stageLabels: Record<QueueStage, string> = {
  EXPECTED: 'Expected',
  ARRIVED: 'Checked in',
  WAITING: 'Waiting',
  WITH_DOCTOR: 'With doctor',
  TREATMENT: 'In treatment',
  BILLING: 'Billing',
  COMPLETED: 'Completed',
};

function clientName(item: QueueAppointment) {
  return item.lead?.patient?.fullName ?? item.lead?.name ?? 'Unknown client';
}

function practitionerName(item: QueueAppointment) {
  return item.doctor?.name ?? item.therapist?.name ?? item.resource?.name ?? 'Not assigned';
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
  if (status === 'REQUESTED' || status === 'SLOT_PROPOSED' || status === 'RESCHEDULED') return { label: 'Schedule', status: 'SCHEDULED' };
  if (['SCHEDULED', 'CONFIRMATION_PENDING', 'CONFIRMED'].includes(status)) return { label: 'Check in', status: 'CHECKED_IN' };
  if (status === 'CHECKED_IN') return { label: 'Add to queue', status: 'WAITING' };
  if (status === 'WAITING' && !isDoctor) return { label: 'Send to consultation', status: 'IN_CONSULTATION' };
  if (status === 'WAITING' && isDoctor) return { label: 'Start consultation', status: 'IN_CONSULTATION' };
  if (['IN_CONSULTATION', 'TREATMENT_IN_PROGRESS'].includes(status) && isDoctor) return { label: 'Send to billing', status: 'BILLING_PENDING' };
  if (status === 'BILLING_PENDING' && !isDoctor) return { label: 'Payment done & close', status: 'COMPLETED' };
  return null;
}

function featuredAction(status: AppointmentStatus, isDoctor: boolean) {
  if (status === 'CHECKED_IN' || status === 'WAITING') {
    return { label: isDoctor ? 'Start consultation' : 'Send to consultation', status: 'IN_CONSULTATION' as AppointmentStatus };
  }
  if (['IN_CONSULTATION', 'TREATMENT_IN_PROGRESS'].includes(status) && isDoctor) return { label: 'Checkout to billing', status: 'BILLING_PENDING' as AppointmentStatus };
  if (status === 'BILLING_PENDING' && !isDoctor) return { label: 'Payment done & close', status: 'COMPLETED' as AppointmentStatus };
  return null;
}

function clientHref(item: QueueAppointment) {
  return item.lead?.patient?.id ? `/patients/${item.lead.patient.id}` : `/leads/${item.leadId}`;
}

export function DailyClientQueueView() {
  const queryClient = useQueryClient();
  const { selectedBranchId, session } = useSessionStore();
  const isDoctor = session?.user.role === 'ADMIN';
  const [selectedDate, setSelectedDate] = useState(localDateKey(new Date()));
  const [search, setSearch] = useState('');
  const [checkInSearch, setCheckInSearch] = useState('');
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

  const records = useMemo(() => queueQuery.data?.data ?? [], [queueQuery.data]);
  const selectedDayRecords = useMemo(
    () => records.filter((item) => localDateKey(new Date(item.appointmentAt)) === selectedDate),
    [records, selectedDate],
  );
  const featuredClient = useMemo(() => {
    const current = selectedDayRecords.find((item) =>
      ['IN_CONSULTATION', 'TREATMENT_IN_PROGRESS', 'BILLING_PENDING'].includes(item.status),
    );
    return current ??
      selectedDayRecords.find((item) => item.status === 'WAITING') ??
      selectedDayRecords.find((item) => item.status === 'CHECKED_IN') ??
      null;
  }, [selectedDayRecords]);

  const waitingCount = selectedDayRecords.filter((item) => item.status === 'WAITING').length;
  const completedCount = selectedDayRecords.filter((item) => item.status === 'COMPLETED').length;
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
            View arrivals, waiting clients, consultations, and completed appointments for the selected date.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-muted px-3 py-1.5 text-muted-foreground">{waitingCount} waiting today</span>
          <span className="rounded-full bg-primary/10 px-3 py-1.5 text-primary">{records.length} scheduled</span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <QueueMetricCard label={`Queue on ${dateLabel(selectedDate)}`} value={selectedDayRecords.length} helper="Appointments for selected date" />
        <QueueMetricCard label="Waiting today" value={waitingCount} helper="Checked-in clients pending doctor/team" />
        <QueueMetricCard label="Completed today" value={completedCount} helper="Clients marked complete on selected date" />
      </div>

      {!selectedBranchId ? (
        <State text="Select a branch in Settings to view its daily client queue." />
      ) : queueQuery.isLoading ? (
        <FeaturedSkeleton />
      ) : queueQuery.isError ? (
        <State text="The daily client queue could not be loaded. Please try again." />
      ) : (
        <FeaturedClient
          appointment={featuredClient}
          expectedAppointments={selectedDayRecords.filter((item) => ['SCHEDULED', 'CONFIRMATION_PENDING', 'CONFIRMED'].includes(item.status))}
          checkInSearch={checkInSearch}
          onCheckInSearch={setCheckInSearch}
          onCheckIn={(id) => updateStatus.mutate({ id, status: 'CHECKED_IN' })}
          isDoctor={isDoctor}
          waitingCount={waitingCount}
          saving={updateStatus.isPending}
          error={updateStatus.isError ? updateStatus.error.message : ''}
          onUpdate={(status) => featuredClient && updateStatus.mutate({ id: featuredClient.id, status })}
        />
      )}

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
            <Select aria-label="Filter by status" value={stage} onChange={(event) => setStage(event.target.value)}>
              <option value="">All statuses</option>
              {Object.entries(stageLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
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
            {selectedDayRecords.length ? 'No clients match the selected filters.' : 'No appointments are scheduled for this date.'}
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
                      active={featuredClient?.id === item.id}
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
                  active={featuredClient?.id === item.id}
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

function FeaturedClient({
  appointment,
  expectedAppointments,
  checkInSearch,
  onCheckInSearch,
  onCheckIn,
  isDoctor,
  waitingCount,
  saving,
  error,
  onUpdate,
}: {
  appointment: QueueAppointment | null;
  expectedAppointments: QueueAppointment[];
  checkInSearch: string;
  onCheckInSearch: (value: string) => void;
  onCheckIn: (id: string) => void;
  isDoctor: boolean;
  waitingCount: number;
  saving: boolean;
  error: string;
  onUpdate: (status: AppointmentStatus) => void;
}) {
  if (!appointment) {
    const term = checkInSearch.trim().toLowerCase();
    const matches = term ? expectedAppointments.filter((item) => clientName(item).toLowerCase().includes(term) || item.lead?.mobile?.includes(term)).slice(0, 6) : [];
    return (
      <Card className="flex min-h-64 flex-col items-center justify-center text-center">
        <span className="grid size-14 place-items-center rounded-full bg-muted text-muted-foreground"><UsersRound className="size-7" /></span>
        <h2 className="mt-4 text-lg font-semibold text-foreground">No client is currently waiting</h2>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">Search today&apos;s booking, verify the client, and check them in to start their clinic visit.</p>
        <div className="mt-5 w-full max-w-xl text-left">
          <label className="relative block">
            <span className="sr-only">Search today&apos;s booked client</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" autoFocus value={checkInSearch} onChange={(event) => onCheckInSearch(event.target.value)} placeholder="Type patient name or mobile number" />
          </label>
          {term ? <div className="mt-2 overflow-hidden rounded-lg border border-border bg-surface">
            {matches.length ? matches.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 border-b border-border p-3 last:border-b-0"><div><div className="font-medium">{clientName(item)}</div><div className="text-xs text-muted-foreground">{appointmentTime(item.appointmentAt)} · {item.lead?.mobile ?? 'No mobile'} · {serviceName(item)}</div></div><Button type="button" disabled={saving} onClick={() => onCheckIn(item.id)}>Check in</Button></div>) : <p className="p-4 text-center text-sm text-muted-foreground">No booked client matches this search.</p>}
          </div> : expectedAppointments.length ? <p className="mt-2 text-center text-xs text-muted-foreground">{expectedAppointments.length} client{expectedAppointments.length === 1 ? '' : 's'} booked for today</p> : <p className="mt-2 text-center text-xs text-muted-foreground">No upcoming bookings remain today.</p>}
        </div>
      </Card>
    );
  }

  const action = featuredAction(appointment.status, isDoctor);
  const current = ['IN_CONSULTATION', 'TREATMENT_IN_PROGRESS', 'BILLING_PENDING'].includes(appointment.status);

  return (
    <Card className="relative overflow-hidden p-0">
      <div className="absolute inset-y-0 left-0 w-1.5 bg-primary" />
      <div className="p-6 md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span className="grid size-14 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><UserRound className="size-7" /></span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">{current ? 'Current client' : 'Next client'}</p>
                <StatusBadge stage={appointment.queueStage} />
              </div>
              <h2 className="mt-1 truncate text-2xl font-semibold text-foreground">{clientName(appointment)}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{appointment.lead?.mobile ?? 'Mobile not available'}</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3 lg:min-w-[510px]">
            <FeaturedDetail icon={Clock3} label="Appointment" value={appointmentTime(appointment.appointmentAt)} />
            <FeaturedDetail icon={Stethoscope} label="Service" value={serviceName(appointment)} />
            <FeaturedDetail icon={UserRound} label="Practitioner" value={practitionerName(appointment)} />
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
          <p className="text-sm text-muted-foreground">
            {waitingCount ? `${waitingCount} client${waitingCount === 1 ? '' : 's'} waiting` : 'No other clients are waiting'}
          </p>
          <div className="flex flex-wrap gap-2">
            {isDoctor && current ? <Link href={clientHref(appointment)} className="inline-flex h-10 items-center gap-2 rounded-md border border-primary/25 bg-primary/5 px-4 text-sm font-medium text-primary hover:bg-primary/10">Treatment & prescription <Stethoscope className="size-4" /></Link> : null}
            {!isDoctor && appointment.status === 'BILLING_PENDING' ? <Link href={clientHref(appointment)} className="inline-flex h-10 items-center gap-2 rounded-md border border-primary/25 bg-primary/5 px-4 text-sm font-medium text-primary hover:bg-primary/10">Billing & payment <ExternalLink className="size-4" /></Link> : null}
            <Link href={clientHref(appointment)} className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-medium text-foreground hover:bg-muted">
              View profile <ExternalLink className="size-4" />
            </Link>
            {action && (
              <Button disabled={saving} onClick={() => onUpdate(action.status)}>
                {saving ? 'Updating...' : action.label}
                {action.status === 'COMPLETED' ? <CheckCircle2 className="size-4" /> : <ArrowRight className="size-4" />}
              </Button>
            )}
          </div>
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-primary">{error}</p>}
      </div>
    </Card>
  );
}

function FeaturedDetail({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground"><Icon className="size-4" /></span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium capitalize text-foreground">{value}</p>
      </div>
    </div>
  );
}

function QueueRow({ appointment, queueNumber, isDoctor, active, saving, onUpdate }: {
  appointment: QueueAppointment;
  queueNumber: number;
  isDoctor: boolean;
  active: boolean;
  saving: boolean;
  onUpdate: (status: AppointmentStatus) => void;
}) {
  const action = nextAction(appointment.status, isDoctor);
  return (
    <tr className={cn('transition hover:bg-muted/30', active && 'bg-primary/5')}>
      <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground"><span className="mr-2 inline-grid size-7 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{queueNumber}</span>{appointmentTime(appointment.appointmentAt)}</td>
      <td className="px-4 py-3">
        <Link href={clientHref(appointment)} className="font-medium text-foreground hover:text-primary">{clientName(appointment)}</Link>
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

function QueueMobileCard({ appointment, queueNumber, isDoctor, active, saving, onUpdate }: {
  appointment: QueueAppointment;
  queueNumber: number;
  isDoctor: boolean;
  active: boolean;
  saving: boolean;
  onUpdate: (status: AppointmentStatus) => void;
}) {
  const action = nextAction(appointment.status, isDoctor);
  return (
    <article className={cn('p-4', active && 'bg-primary/5')}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href={clientHref(appointment)} className="font-medium text-foreground"><span className="mr-2 inline-grid size-6 place-items-center rounded-full bg-primary/10 text-xs text-primary">{queueNumber}</span>{clientName(appointment)}</Link>
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

function FeaturedSkeleton() {
  return (
    <Card className="p-7" aria-label="Loading current client" aria-busy="true">
      <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
        <div className="flex items-center gap-4"><Skeleton className="size-14 rounded-full" /><div className="space-y-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-7 w-52" /><Skeleton className="h-4 w-32" /></div></div>
        <div className="grid flex-1 gap-4 sm:grid-cols-3 lg:max-w-[510px]">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-12" />)}</div>
      </div>
    </Card>
  );
}

function State({ text }: { text: string }) {
  return <Card className="p-10 text-center text-sm text-muted-foreground">{text}</Card>;
}
