'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Clock3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiRequest } from '@/services/api';
import { useSessionStore } from '@/store/session-store';
import type { AppointmentStatus } from '@/types/appointment';
import type { QueueAppointment, QueueStage } from '@/types/front-desk';

const stages: Array<{ key: QueueStage; label: string }> = [{ key: 'EXPECTED', label: 'Expected' }, { key: 'ARRIVED', label: 'Arrived' }, { key: 'WAITING', label: 'Waiting' }, { key: 'WITH_DOCTOR', label: 'With doctor' }, { key: 'TREATMENT', label: 'Treatment' }, { key: 'COMPLETED', label: 'Completed' }];
function nextStatus(status: AppointmentStatus): { label: string; status: AppointmentStatus } | null {
  if (status === 'REQUESTED' || status === 'SLOT_PROPOSED') return { label: 'Schedule', status: 'SCHEDULED' };
  if (['SCHEDULED', 'CONFIRMATION_PENDING', 'CONFIRMED'].includes(status)) return { label: 'Check in', status: 'CHECKED_IN' };
  if (status === 'CHECKED_IN') return { label: 'Start waiting', status: 'WAITING' };
  if (status === 'WAITING') return { label: 'With doctor', status: 'IN_CONSULTATION' };
  if (status === 'IN_CONSULTATION') return { label: 'Start treatment', status: 'TREATMENT_IN_PROGRESS' };
  if (status === 'TREATMENT_IN_PROGRESS') return { label: 'Complete', status: 'COMPLETED' };
  if (status === 'BILLING_PENDING') return { label: 'Complete', status: 'COMPLETED' };
  return null;
}

export function TodayQueueView() {
  const client = useQueryClient(); const { selectedBranchId } = useSessionStore();
  const query = useQuery({ queryKey: ['today-queue', selectedBranchId], queryFn: () => apiRequest<{ data: QueueAppointment[] }>(`/front-desk/today-queue?branchId=${selectedBranchId}`), enabled: Boolean(selectedBranchId), refetchInterval: 30_000 });
  const update = useMutation({ mutationFn: ({ id, status }: { id: string; status: AppointmentStatus }) => apiRequest(`/appointments/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }), onSuccess: () => client.invalidateQueries({ queryKey: ['today-queue'] }) });
  const records = query.data?.data ?? [];
  return <section className="space-y-5"><div><h1 className="text-2xl font-semibold">Today&apos;s Queue</h1><p className="text-sm text-muted-foreground">Live front-desk flow from expected arrival through treatment completion.</p></div>
    {!selectedBranchId ? <State text="Select a branch to view its queue." /> : query.isLoading ? <State text="Loading today’s queue…" /> : query.isError ? <State text="The queue could not be loaded." /> : <div className="grid gap-4 xl:grid-cols-4">{stages.map((stage) => { const items = records.filter((item) => item.queueStage === stage.key); return <Card key={stage.key} className="min-h-40 p-3"><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">{stage.label}</h2><span className="rounded-full bg-muted px-2 py-0.5 text-xs">{items.length}</span></div><div className="space-y-2">{items.length === 0 ? <p className="py-5 text-center text-xs text-muted-foreground">No patients</p> : items.map((appointment) => { const next = nextStatus(appointment.status); return <div key={appointment.id} className="rounded-md border bg-background p-3"><div className="font-medium">{appointment.lead?.patient?.fullName ?? appointment.lead?.name}</div><div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="size-3" />{new Date(appointment.appointmentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {appointment.service?.name ?? appointment.appointmentType.replaceAll('_', ' ')}</div><div className="mt-2 text-xs text-muted-foreground">{appointment.doctor?.name ?? appointment.therapist?.name ?? appointment.resource?.name ?? 'Practitioner not assigned'}</div>{next ? <Button className="mt-3 h-8 w-full px-2 text-xs" disabled={update.isPending} onClick={() => update.mutate({ id: appointment.id, status: next.status })}>{next.label}<ArrowRight className="size-3" /></Button> : null}</div>; })}</div></Card>; })}</div>}
  </section>;
}
function State({ text }: { text: string }) { return <Card className="p-10 text-center text-sm text-muted-foreground">{text}</Card>; }
