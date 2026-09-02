'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, BellRing, CalendarClock, CheckCircle2, Clock3, Phone, Search } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SegmentedTabs } from '@/components/ui/data-visuals';
import { RowsSkeleton } from '@/components/ui/skeleton';
import { apiRequest } from '@/services/api';
import { useSessionStore } from '@/store/session-store';
import type { FollowUp, Task } from '@/types/foundation';

type ReminderRow = {
  id: string;
  kind: 'FOLLOW_UP' | 'TASK';
  title: string;
  detail: string;
  personName?: string;
  mobile?: string;
  branch: string;
  assignedTo: string;
  dueAt: string;
  alertAt: string;
  status: string;
  leadId?: string;
  source: FollowUp | Task;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

export function NotificationsView() {
  const client = useQueryClient();
  const { session, selectedBranchId } = useSessionStore();
  const [tab, setTab] = useState<'DUE' | 'UPCOMING' | 'COMPLETED'>('DUE');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ReminderRow | null>(null);
  const [actionTaken, setActionTaken] = useState('');
  const params = new URLSearchParams();
  if (selectedBranchId) params.set('branchId', selectedBranchId);
  if (session?.user.role === 'RECEPTIONIST') params.set('assignedUserId', session.user.id);

  const followUps = useQuery({
    queryKey: ['notification-follow-ups', selectedBranchId, session?.user.id],
    queryFn: () => apiRequest<{ data: FollowUp[] }>(`/follow-ups?${params}`),
    enabled: Boolean(session && (session.user.role === 'ADMIN' || selectedBranchId)),
    refetchInterval: 30_000,
  });
  const tasks = useQuery({
    queryKey: ['notification-tasks', selectedBranchId, session?.user.id],
    queryFn: () => apiRequest<{ data: Task[] }>(`/tasks?${params}`),
    enabled: Boolean(session && (session.user.role === 'ADMIN' || selectedBranchId)),
    refetchInterval: 30_000,
  });

  const rows = useMemo<ReminderRow[]>(() => [
    ...(followUps.data?.data ?? []).map((item) => ({
      id: item.id, kind: 'FOLLOW_UP' as const, title: item.activityType,
      detail: item.notes || item.lead?.interestedTreatment || 'Lead follow-up',
      personName: item.person.fullName, mobile: item.person.primaryMobile,
      branch: item.branch.name, assignedTo: item.assignedUser.name, dueAt: item.dueAt,
      alertAt: item.reminderAt || item.dueAt, status: item.status, leadId: item.lead?.id, source: item,
    })),
    ...(tasks.data?.data ?? []).map((item) => ({
      id: item.id, kind: 'TASK' as const, title: item.title,
      detail: item.description || item.type.replaceAll('_', ' '),
      personName: item.person?.fullName, mobile: item.person?.primaryMobile,
      branch: item.branch.name, assignedTo: item.assignedUser.name, dueAt: item.dueAt,
      alertAt: item.reminderAt || item.dueAt, status: item.status, leadId: item.lead?.id, source: item,
    })),
  ].sort((a, b) => new Date(a.alertAt).getTime() - new Date(b.alertAt).getTime()), [followUps.data, tasks.data]);

  const now = Date.now();
  const visible = rows.filter((row) => {
    const completed = ['COMPLETED', 'CANCELLED'].includes(row.status);
    const alertDue = new Date(row.alertAt).getTime() <= now;
    const matchesTab = tab === 'COMPLETED' ? completed : tab === 'DUE' ? !completed && alertDue : !completed && !alertDue;
    const term = search.trim().toLowerCase();
    return matchesTab && (!term || [row.title, row.detail, row.personName, row.mobile, row.branch].some((value) => value?.toLowerCase().includes(term)));
  });
  const dueCount = rows.filter((row) => !['COMPLETED', 'CANCELLED'].includes(row.status) && new Date(row.alertAt).getTime() <= now).length;
  const overdueCount = rows.filter((row) => !['COMPLETED', 'CANCELLED'].includes(row.status) && new Date(row.dueAt).getTime() < now).length;
  const upcomingCount = rows.filter((row) => !['COMPLETED', 'CANCELLED'].includes(row.status) && new Date(row.alertAt).getTime() > now).length;
  const completedCount = rows.filter((row) => ['COMPLETED', 'CANCELLED'].includes(row.status)).length;

  const complete = useMutation({
    mutationFn: ({ row, notes }: { row: ReminderRow; notes: string }) => row.kind === 'FOLLOW_UP'
      ? apiRequest(`/follow-ups/${row.id}/complete`, { method: 'POST', body: JSON.stringify({ outcome: notes, notes, resolution: 'CLOSED' }) })
      : apiRequest(`/tasks/${row.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'COMPLETED', completionNotes: notes }) }),
    onSuccess: () => {
      setSelected(null); setActionTaken('');
      client.invalidateQueries({ queryKey: ['notification-follow-ups'] });
      client.invalidateQueries({ queryKey: ['notification-tasks'] });
      client.invalidateQueries({ queryKey: ['tasks'] });
      client.invalidateQueries({ queryKey: ['header-reminders'] });
      client.invalidateQueries({ queryKey: ['dashboard-overview'] });
    },
  });

  return <section className="space-y-5">
    <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Team work inbox</p><h1 className="mt-1 text-2xl font-semibold">Notifications & Followups</h1><p className="text-sm text-muted-foreground">One place for scheduled lead followups and assigned tasks. Alerts appear before their due time and refresh every 30 seconds.</p></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={Clock3} label="Due / pending" value={dueCount} urgent={dueCount > 0} /><Metric icon={AlertTriangle} label="Overdue" value={overdueCount} urgent={overdueCount > 0} /><Metric icon={CalendarClock} label="Upcoming" value={upcomingCount} /><Metric icon={CheckCircle2} label="Action taken" value={completedCount} /></div>
    <Card className="p-3"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><SegmentedTabs tabs={[{ label: 'Due & pending', value: 'DUE', count: dueCount }, { label: 'Upcoming', value: 'UPCOMING', count: upcomingCount }, { label: 'Action taken', value: 'COMPLETED', count: completedCount }]} value={tab} onChange={setTab} /><label className="relative w-full lg:max-w-sm"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search notifications and followups" /></label></div></Card>
    {selected ? <Card className="border-primary/30 bg-primary/5"><h2 className="font-semibold">Record action taken: {selected.title}</h2><p className="mt-1 text-sm text-muted-foreground">This closes the reminder and preserves the outcome in the CRM history.</p><div className="mt-4 flex flex-col gap-2 sm:flex-row"><Input value={actionTaken} onChange={(event) => setActionTaken(event.target.value)} placeholder="Example: Called patient; appointment confirmed" /><Button disabled={!actionTaken.trim() || complete.isPending} onClick={() => complete.mutate({ row: selected, notes: actionTaken.trim() })}>{complete.isPending ? 'Saving...' : 'Save action & close'}</Button><Button variant="secondary" onClick={() => { setSelected(null); setActionTaken(''); }}>Cancel</Button></div>{complete.isError ? <p className="mt-2 text-sm text-red-600">{complete.error.message}</p> : null}</Card> : null}
    <Card className="overflow-hidden p-0">{followUps.isLoading || tasks.isLoading ? <RowsSkeleton rows={7} /> : followUps.isError || tasks.isError ? <Empty text="Notifications and followups could not be loaded." /> : !visible.length ? <Empty text="Nothing in this view." /> : <div className="divide-y divide-border">{visible.map((row) => { const completed = ['COMPLETED', 'CANCELLED'].includes(row.status); const overdue = !completed && new Date(row.dueAt).getTime() < now; const alertDue = !completed && new Date(row.alertAt).getTime() <= now; const stateLabel = completed ? 'ACTION TAKEN' : overdue ? 'OVERDUE' : alertDue ? 'DUE / PENDING' : 'UPCOMING'; const stateClass = completed ? 'bg-emerald-50 text-emerald-700' : overdue ? 'bg-red-50 text-red-700' : alertDue ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'; return <article key={`${row.kind}-${row.id}`} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{row.kind === 'FOLLOW_UP' ? 'FOLLOWUP' : 'TASK'}</span><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${stateClass}`}>{stateLabel}</span><h2 className="font-medium">{row.title}</h2></div><p className="mt-1 text-sm text-muted-foreground">{row.personName ? `${row.personName} · ` : ''}{row.detail}</p><p className="mt-1 text-xs text-muted-foreground">{row.branch} · Assigned to {row.assignedTo}</p><p className="mt-1 text-xs text-muted-foreground">Notification {formatDateTime(row.alertAt)} · Due {formatDateTime(row.dueAt)}</p></div><div className="flex flex-wrap gap-2">{row.mobile ? <a className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm font-medium hover:bg-muted" href={`tel:${row.mobile}`}><Phone className="size-4" />Call</a> : null}{row.leadId ? <Link className="inline-flex h-10 items-center rounded-md border border-border px-3 text-sm font-medium hover:bg-muted" href={`/leads/${row.leadId}`}>Open lead</Link> : null}{!completed ? <Button onClick={() => setSelected(row)}>Record action taken</Button> : null}</div></article>; })}</div>}</Card>
  </section>;
}

function Metric({ icon: Icon, label, value, urgent = false }: { icon: React.ElementType; label: string; value: number; urgent?: boolean }) { return <Card className="flex items-center justify-between p-4"><div><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className={`mt-1 text-2xl font-semibold ${urgent ? 'text-red-600' : ''}`}>{value}</p></div><span className={`grid size-10 place-items-center rounded-lg ${urgent ? 'bg-red-50 text-red-600' : 'bg-primary/10 text-primary'}`}><Icon className="size-5" /></span></Card>; }
function Empty({ text }: { text: string }) { return <div className="p-10 text-center"><BellRing className="mx-auto size-8 text-muted-foreground/40" /><p className="mt-2 text-sm text-muted-foreground">{text}</p></div>; }
