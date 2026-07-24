'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CalendarDays, FileWarning, Stethoscope, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { PageSkeleton } from '@/components/ui/skeleton';
import { apiRequest } from '@/services/api';
import { useSessionStore } from '@/store/session-store';
import type { DoctorWorkspace } from '@/types/clinical';

const format = (value: string) => new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
const label = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/^./, (letter) => letter.toUpperCase());

export function DoctorWorkspaceView() {
  const { selectedBranchId, session } = useSessionStore();
  const query = useQuery({
    queryKey: ['doctor-workspace', selectedBranchId],
    queryFn: () => apiRequest<{ data: DoctorWorkspace }>(`/clinical/doctor-workspace${selectedBranchId ? `?branchId=${selectedBranchId}` : ''}`),
    enabled: Boolean(session),
  });
  if (query.isLoading) return <PageSkeleton />;
  if (query.isError || !query.data) return <Card className="border-red-200 text-sm text-red-700">{query.error?.message ?? 'Doctor workspace could not be loaded.'}</Card>;
  const data = query.data.data;
  return <section className="space-y-5"><div><h1 className="text-2xl font-semibold">Doctor Workspace</h1><p className="text-sm text-muted-foreground">Today’s consultations, waiting patients, incomplete documentation and clinical alerts.</p></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric icon={CalendarDays} title="Today’s consultations" value={data.consultations.length} /><Metric icon={UsersRound} title="Waiting patients" value={data.waitingPatients.length} /><Metric icon={FileWarning} title="Incomplete notes" value={data.incompleteNotes.length + data.prescriptionActions.length} /><Metric icon={AlertTriangle} title="Clinical alerts" value={data.alerts.length + data.adverseEvents.length} warning={data.alerts.length + data.adverseEvents.length > 0} /></div>
    <div className="grid gap-4 xl:grid-cols-2"><Card><h2 className="font-semibold">Today’s clinical queue</h2><div className="mt-4 space-y-2">{data.consultations.length ? data.consultations.map((appointment) => { const patient = appointment.lead?.patient; return <div key={appointment.id} className="flex items-center justify-between gap-3 rounded-md border p-3"><div><div className="font-medium">{appointment.lead?.name}</div><div className="text-xs text-muted-foreground">{format(appointment.appointmentAt)} · {label(appointment.status)}</div></div>{patient ? <Link href={`/patients/${patient.id}`} className="rounded-md border px-3 py-2 text-sm font-medium text-primary">Open chart</Link> : <span className="text-xs text-muted-foreground">Registration pending</span>}</div>; }) : <Empty text="No consultations assigned today." />}</div></Card>
      <Card><h2 className="font-semibold">Incomplete and unsigned notes</h2><div className="mt-4 space-y-2">{data.incompleteNotes.length ? data.incompleteNotes.map((encounter) => <Link key={encounter.id} href={`/patients/${encounter.patient.id}`} className="block rounded-md border p-3 hover:bg-muted"><div className="font-medium">{encounter.patient.fullName}</div><div className="text-xs text-muted-foreground">{label(encounter.type)} · {label(encounter.status)} · {format(encounter.visitDate)}</div></Link>) : <Empty text="No incomplete clinical notes." />}</div></Card>
      <Card><h2 className="font-semibold">Plans requiring review</h2><div className="mt-4 space-y-2">{data.plansForReview.length ? data.plansForReview.map((plan) => <Link key={plan.id} href={`/patients/${plan.patient.id}`} className="block rounded-md border p-3 hover:bg-muted"><div className="font-medium">{plan.patient.fullName} · {plan.concern}</div><div className="text-xs text-muted-foreground">{label(plan.status)} · Review {plan.reviewDate ? format(plan.reviewDate) : 'due'}</div></Link>) : <Empty text="No treatment plans need review." />}</div></Card>
      <Card><h2 className="font-semibold">Follow-ups due</h2><div className="mt-4 space-y-2">{data.followUpsDue.length ? data.followUpsDue.map((followUp) => <Link key={followUp.id} href={followUp.patient ? `/patients/${followUp.patient.id}` : '/follow-ups'} className="block rounded-md border p-3 hover:bg-muted"><div className="font-medium">{followUp.patient?.fullName ?? label(followUp.activityType)}</div><div className="text-xs text-muted-foreground">{label(followUp.activityType)} · Due {format(followUp.dueAt)}</div></Link>) : <Empty text="No clinical follow-ups due." />}</div></Card>
      <Card><h2 className="font-semibold">Prescription actions</h2><div className="mt-4 space-y-2">{data.prescriptionActions.length ? data.prescriptionActions.map((prescription) => <Link key={prescription.id} href={`/patients/${prescription.patient.id}`} className="block rounded-md border p-3 hover:bg-muted"><div className="font-medium">{prescription.patient.fullName} · {prescription.prescriptionNo}</div><div className="text-xs text-muted-foreground">Draft awaiting review and signature</div></Link>) : <Empty text="No draft prescriptions awaiting action." />}</div></Card>
      <Card className={data.alerts.length || data.adverseEvents.length ? 'border-red-200' : ''}><h2 className="flex items-center gap-2 font-semibold"><Stethoscope className="size-4" />Critical and adverse-event alerts</h2><div className="mt-4 space-y-2">{data.alerts.map((patient) => <Link key={`alert-${patient.id}`} href={`/patients/${patient.id}`} className="block rounded-md border border-red-200 bg-red-50 p-3"><div className="font-medium text-red-900">{patient.fullName}</div><div className="text-xs text-red-700">Critical medical alert · Open chart before treatment</div></Link>)}{data.adverseEvents.map((event) => <Link key={`event-${event.id}`} href={`/patients/${event.patient.id}`} className="block rounded-md border border-red-200 bg-red-50 p-3"><div className="font-medium text-red-900">{event.patient.fullName}</div><div className="text-xs text-red-700">Adverse event · {event.procedureName}</div></Link>)}{!data.alerts.length && !data.adverseEvents.length ? <Empty text="No critical or adverse-event alerts." /> : null}</div></Card></div>
  </section>;
}
function Metric({ icon: Icon, title, value, warning }: { icon: React.ElementType; title: string; value: number; warning?: boolean }) { return <Card className="flex items-center gap-3"><div className={`rounded-md p-2 ${warning ? 'bg-red-100 text-red-700' : 'bg-primary/10 text-primary'}`}><Icon className="size-5" /></div><div><div className="text-2xl font-semibold">{value}</div><div className="text-xs text-muted-foreground">{title}</div></div></Card>; }
function Empty({ text }: { text: string }) { return <div className="py-8 text-center text-sm text-muted-foreground">{text}</div>; }
