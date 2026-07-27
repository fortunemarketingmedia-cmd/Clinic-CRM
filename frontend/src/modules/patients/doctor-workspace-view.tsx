'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Activity, CalendarDays, CheckCircle2, Clock3, FileWarning, Filter, HeartPulse, ListChecks, Pill, Stethoscope, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PageSkeleton } from '@/components/ui/skeleton';
import { apiRequest } from '@/services/api';
import { useSessionStore } from '@/store/session-store';
import type { Appointment, AppointmentStatus } from '@/types/appointment';
import type { DoctorWorkspace } from '@/types/clinical';

const format = (value: string) => new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
const label = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
const todayLocal = () => { const date = new Date(); date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); return date.toISOString().slice(0, 10); };
const percent = (value: number, total: number) => total ? Math.round((value / total) * 100) : 0;
const activeStatuses: AppointmentStatus[] = ['CHECKED_IN', 'WAITING', 'IN_CONSULTATION', 'TREATMENT_IN_PROGRESS', 'BILLING_PENDING'];

export function DoctorWorkspaceView() {
  const { selectedBranchId, session } = useSessionStore();
  const [selectedDate, setSelectedDate] = useState(todayLocal());
  const [queueStatus, setQueueStatus] = useState<AppointmentStatus | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const query = useQuery({
    queryKey: ['doctor-workspace', selectedBranchId, selectedDate],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedBranchId) params.set('branchId', selectedBranchId);
      if (selectedDate) params.set('date', selectedDate);
      return apiRequest<{ data: DoctorWorkspace }>(`/clinical/doctor-workspace?${params.toString()}`);
    },
    enabled: Boolean(session),
  });

  const data = query.data?.data;
  const queue = useMemo(() => {
    const items = data?.consultations ?? [];
    return items.filter((appointment) => {
      const patient = appointment.lead?.patient;
      const searchText = `${appointment.lead?.name ?? ''} ${patient?.fullName ?? ''} ${patient?.patientNo ?? ''} ${appointment.lead?.mobile ?? ''}`.toLowerCase();
      const matchesSearch = !search.trim() || searchText.includes(search.trim().toLowerCase());
      const matchesStatus = queueStatus === 'ALL' || appointment.status === queueStatus;
      return matchesSearch && matchesStatus;
    });
  }, [data?.consultations, queueStatus, search]);

  if (query.isLoading) return <PageSkeleton />;
  if (query.isError || !data) return <Card className="border-red-200 text-sm text-red-700">{query.error?.message ?? 'Doctor workspace could not be loaded.'}</Card>;

  const totalConsultations = data.consultations.length;
  const completed = data.consultations.filter((item) => item.status === 'COMPLETED').length;
  const activeQueue = data.consultations.filter((item) => activeStatuses.includes(item.status)).length;
  const documentationPending = data.incompleteNotes.length + data.prescriptionActions.length;
  const alertCount = data.alerts.length + data.adverseEvents.length;
  const reviewCount = data.plansForReview.length + data.followUpsDue.length;
  const completionRate = percent(completed, totalConsultations);
  const waitingRate = percent(data.waitingPatients.length, totalConsultations);
  const documentationRate = percent(documentationPending, documentationPending + completed);
  const statusRows = buildStatusRows(data.consultations);

  return <section className="space-y-5">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h1 className="text-2xl font-semibold">Doctor Workspace</h1>
        <p className="text-sm text-muted-foreground">Clinical command center for queue, notes, prescriptions, reviews and safety alerts.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-[170px_180px_auto]">
        <Input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} aria-label="Workspace date" />
        <Select value={queueStatus} onChange={(event) => setQueueStatus(event.target.value as AppointmentStatus | 'ALL')} aria-label="Queue status filter">
          <option value="ALL">All queue statuses</option>
          {['SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'WAITING', 'IN_CONSULTATION', 'TREATMENT_IN_PROGRESS', 'BILLING_PENDING', 'COMPLETED'].map((status) => <option key={status} value={status}>{label(status)}</option>)}
        </Select>
        <Button type="button" variant="secondary" onClick={() => { setSelectedDate(todayLocal()); setQueueStatus('ALL'); setSearch(''); }}><Filter className="size-4" />Reset</Button>
      </div>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      <Kpi icon={CalendarDays} title="Consultations" value={totalConsultations} caption={`${completionRate}% completed`} />
      <Kpi icon={UsersRound} title="Waiting now" value={data.waitingPatients.length} caption={`${waitingRate}% of day`} warning={data.waitingPatients.length > 0} />
      <Kpi icon={Activity} title="Active queue" value={activeQueue} caption="Checked-in to billing" />
      <Kpi icon={FileWarning} title="Pending notes" value={documentationPending} caption={`${documentationRate}% pending load`} warning={documentationPending > 0} />
      <Kpi icon={ListChecks} title="Reviews due" value={reviewCount} caption="Plans + follow-ups" warning={reviewCount > 0} />
      <Kpi icon={AlertTriangle} title="Safety alerts" value={alertCount} caption="Critical + adverse" warning={alertCount > 0} />
    </div>

    <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-semibold">Queue analytics</h2>
            <p className="text-sm text-muted-foreground">Status split for the selected date and branch.</p>
          </div>
          <div className="text-sm font-medium text-muted-foreground">{queue.length} visible clients</div>
        </div>
        <div className="mt-4 space-y-3">
          {statusRows.length ? statusRows.map((row) => <BarRow key={row.label} label={row.label} value={row.value} total={totalConsultations} />) : <Empty text="No queue data for this date." />}
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold">Workload health</h2>
        <div className="mt-4 grid gap-3">
          <HealthRow icon={CheckCircle2} label="Completion rate" value={`${completionRate}%`} note={`${completed}/${totalConsultations} consultations completed`} />
          <HealthRow icon={Clock3} label="Waiting pressure" value={`${waitingRate}%`} note={`${data.waitingPatients.length} clients waiting`} warning={data.waitingPatients.length > 0} />
          <HealthRow icon={Pill} label="Prescription actions" value={String(data.prescriptionActions.length)} note="Draft prescriptions pending review" warning={data.prescriptionActions.length > 0} />
          <HealthRow icon={HeartPulse} label="Clinical risk" value={String(alertCount)} note="Open critical/adverse-event signals" warning={alertCount > 0} />
        </div>
      </Card>
    </div>

    <Card>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-semibold">Today’s clinical queue</h2>
          <p className="text-sm text-muted-foreground">Open a client chart directly from the queue.</p>
        </div>
        <Input className="lg:max-w-xs" placeholder="Search client, mobile or client no." value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>
      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        {queue.length ? queue.map((appointment) => <QueueCard key={appointment.id} appointment={appointment} />) : <div className="xl:col-span-2"><Empty text="No clients match these queue filters." /></div>}
      </div>
    </Card>

    <div className="grid gap-4 xl:grid-cols-2">
      <ActionPanel title="Incomplete and unsigned notes" empty="No incomplete clinical notes." items={data.incompleteNotes.map((encounter) => ({ id: encounter.id, href: `/patients/${encounter.patient.id}`, title: encounter.patient.fullName, subtitle: `${label(encounter.type)} · ${label(encounter.status)} · ${format(encounter.visitDate)}` }))} />
      <ActionPanel title="Plans requiring review" empty="No treatment plans need review." items={data.plansForReview.map((plan) => ({ id: plan.id, href: `/patients/${plan.patient.id}`, title: `${plan.patient.fullName} · ${plan.concern}`, subtitle: `${label(plan.status)} · Review ${plan.reviewDate ? format(plan.reviewDate) : 'due'}` }))} />
      <ActionPanel title="Follow-ups due" empty="No clinical follow-ups due." items={data.followUpsDue.map((followUp) => ({ id: followUp.id, href: followUp.patient ? `/patients/${followUp.patient.id}` : '/follow-ups', title: followUp.patient?.fullName ?? label(followUp.activityType), subtitle: `${label(followUp.activityType)} · Due ${format(followUp.dueAt)}` }))} />
      <ActionPanel title="Prescription actions" empty="No draft prescriptions awaiting action." items={data.prescriptionActions.map((prescription) => ({ id: prescription.id, href: `/patients/${prescription.patient.id}`, title: `${prescription.patient.fullName} · ${prescription.prescriptionNo}`, subtitle: 'Draft awaiting review and signature' }))} />
      <Card className={`xl:col-span-2 ${alertCount ? 'border-red-200' : ''}`}>
        <h2 className="flex items-center gap-2 font-semibold"><Stethoscope className="size-4" />Critical and adverse-event alerts</h2>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {data.alerts.map((patient) => <Link key={`alert-${patient.id}`} href={`/patients/${patient.id}`} className="block rounded-md border border-red-200 bg-red-50 p-3 hover:bg-red-100"><div className="font-medium text-red-900">{patient.fullName}</div><div className="text-xs text-red-700">Critical medical alert · Open chart before treatment</div></Link>)}
          {data.adverseEvents.map((event) => <Link key={`event-${event.id}`} href={`/patients/${event.patient.id}`} className="block rounded-md border border-red-200 bg-red-50 p-3 hover:bg-red-100"><div className="font-medium text-red-900">{event.patient.fullName}</div><div className="text-xs text-red-700">Adverse event · {event.procedureName}</div></Link>)}
          {!alertCount ? <div className="lg:col-span-2"><Empty text="No critical or adverse-event alerts." /></div> : null}
        </div>
      </Card>
    </div>
  </section>;
}

function buildStatusRows(appointments: Appointment[]) {
  const counts = new Map<string, number>();
  appointments.forEach((appointment) => counts.set(label(appointment.status), (counts.get(label(appointment.status)) ?? 0) + 1));
  return Array.from(counts.entries()).map(([rowLabel, value]) => ({ label: rowLabel, value })).sort((a, b) => b.value - a.value);
}
function Kpi({ icon: Icon, title, value, caption, warning }: { icon: React.ElementType; title: string; value: number; caption: string; warning?: boolean }) { return <Card className="p-4"><div className="flex items-start justify-between gap-3"><div className={`rounded-md p-2 ${warning ? 'bg-red-100 text-red-700' : 'bg-primary/10 text-primary'}`}><Icon className="size-5" /></div><div className="text-right"><div className="text-2xl font-semibold">{value}</div><div className="text-xs text-muted-foreground">{title}</div></div></div><div className={`mt-3 text-xs ${warning ? 'text-red-700' : 'text-muted-foreground'}`}>{caption}</div></Card>; }
function BarRow({ label: rowLabel, value, total }: { label: string; value: number; total: number }) { const width = Math.max(percent(value, total), value ? 6 : 0); return <div><div className="mb-2 flex items-center justify-between text-sm"><span className="text-muted-foreground">{rowLabel}</span><span className="font-semibold">{value}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} /></div></div>; }
function HealthRow({ icon: Icon, label: rowLabel, value, note, warning }: { icon: React.ElementType; label: string; value: string; note: string; warning?: boolean }) { return <div className={`rounded-md border p-3 ${warning ? 'border-red-200 bg-red-50' : ''}`}><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 font-medium"><Icon className={`size-4 ${warning ? 'text-red-700' : 'text-primary'}`} />{rowLabel}</div><div className="font-semibold">{value}</div></div><div className="mt-1 text-xs text-muted-foreground">{note}</div></div>; }
function QueueCard({ appointment }: { appointment: Appointment }) { const patient = appointment.lead?.patient; return <div className="rounded-md border p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-medium">{patient?.fullName ?? appointment.lead?.name ?? 'Unnamed client'}</div><div className="text-xs text-muted-foreground">{format(appointment.appointmentAt)} · {label(appointment.status)}</div><div className="mt-1 text-xs text-muted-foreground">{appointment.service?.name ?? label(appointment.appointmentType)} · {appointment.doctor?.name ?? 'Practitioner not assigned'}</div></div>{patient ? <Link href={`/patients/${patient.id}`} className="rounded-md border px-3 py-2 text-sm font-medium text-primary hover:bg-muted">Open chart</Link> : <span className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">Registration pending</span>}</div></div>; }
function ActionPanel({ title, empty, items }: { title: string; empty: string; items: Array<{ id: string; href: string; title: string; subtitle: string }> }) { return <Card><div className="flex items-center justify-between gap-3"><h2 className="font-semibold">{title}</h2><span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">{items.length}</span></div><div className="mt-4 space-y-2">{items.length ? items.map((item) => <Link key={item.id} href={item.href} className="block rounded-md border p-3 hover:bg-muted"><div className="font-medium">{item.title}</div><div className="mt-1 text-xs text-muted-foreground">{item.subtitle}</div></Link>) : <Empty text={empty} />}</div></Card>; }
function Empty({ text }: { text: string }) { return <div className="py-8 text-center text-sm text-muted-foreground">{text}</div>; }
