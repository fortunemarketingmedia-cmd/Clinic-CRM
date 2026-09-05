'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, CalendarClock, CheckCircle2, Clock3, Phone, Search } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { RowsSkeleton } from '@/components/ui/skeleton';
import { apiRequest } from '@/services/api';
import { useSessionStore } from '@/store/session-store';
import type { FollowUp } from '@/types/foundation';

type WorklistTab = 'CURRENT' | 'UPCOMING' | 'PAST' | 'COMPLETED';

function tabFor(item: FollowUp, now = new Date()): WorklistTab {
  if (['COMPLETED', 'CANCELLED'].includes(item.status)) return 'COMPLETED';
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end = new Date(now); end.setHours(23, 59, 59, 999);
  const due = new Date(item.dueAt).getTime();
  if (due < start.getTime()) return 'PAST';
  if (due > end.getTime()) return 'UPCOMING';
  return 'CURRENT';
}

function formatDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString('en-IN') : '-';
}

export function FollowUpWorklistView() {
  const client = useQueryClient();
  const { session, selectedBranchId } = useSessionStore();
  const [tab, setTab] = useState<WorklistTab>('CURRENT');
  const [search, setSearch] = useState('');
  const [assignee, setAssignee] = useState('');
  const [selected, setSelected] = useState<FollowUp | null>(null);
  const [outcome, setOutcome] = useState('');
  const params = new URLSearchParams();
  if (selectedBranchId) params.set('branchId', selectedBranchId);
  params.set('scope', 'ALL');
  const query = useQuery({
    queryKey: ['follow-up-worklist', selectedBranchId],
    queryFn: () => apiRequest<{ data: FollowUp[] }>(`/follow-ups?${params}`),
    enabled: Boolean(session && (session.user.role === 'ADMIN' || selectedBranchId)),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
  const items = useMemo(() => query.data?.data ?? [], [query.data]);
  const assignees = useMemo(() => Array.from(new Map(items.map((item) => [item.assignedUser.id, item.assignedUser])).values()), [items]);
  const counts = useMemo(() => ({
    CURRENT: items.filter((item) => tabFor(item) === 'CURRENT').length,
    UPCOMING: items.filter((item) => tabFor(item) === 'UPCOMING').length,
    PAST: items.filter((item) => tabFor(item) === 'PAST').length,
    COMPLETED: items.filter((item) => tabFor(item) === 'COMPLETED').length,
  }), [items]);
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => tabFor(item) === tab && (!assignee || item.assignedUser.id === assignee) && (!term || [item.person.fullName, item.person.primaryMobile, item.activityType, item.notes, item.lead?.interestedTreatment].some((value) => value?.toLowerCase().includes(term))));
  }, [assignee, items, search, tab]);
  const complete = useMutation({
    mutationFn: () => apiRequest(`/follow-ups/${selected?.id}/complete`, { method: 'POST', body: JSON.stringify({ outcome: outcome.trim(), notes: outcome.trim(), resolution: 'CLOSED' }) }),
    onSuccess: () => {
      setSelected(null); setOutcome('');
      client.invalidateQueries({ queryKey: ['follow-up-worklist'] });
      client.invalidateQueries({ queryKey: ['header-reminders'] });
      client.invalidateQueries({ queryKey: ['sales-pipeline'] });
    },
  });
  const tabs: Array<{ value: WorklistTab; label: string }> = [
    { value: 'CURRENT', label: 'Current' }, { value: 'UPCOMING', label: 'Upcoming' },
    { value: 'PAST', label: 'Past due' }, { value: 'COMPLETED', label: 'Completed' },
  ];

  return <section className="space-y-5">
    <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Reception worklist</p><h1 className="mt-1 text-2xl font-semibold">Follow-up Worklist</h1><p className="text-sm text-muted-foreground">All lead follow-ups and reminder times in one dedicated queue.</p></div>
    <div className="grid gap-3 sm:grid-cols-4">{tabs.map((item) => <Card key={item.value} className="flex items-center justify-between p-4"><div><p className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</p><p className="mt-1 text-2xl font-semibold">{counts[item.value]}</p></div>{item.value === 'COMPLETED' ? <CheckCircle2 className="size-5 text-emerald-600" /> : item.value === 'PAST' ? <Clock3 className="size-5 text-red-600" /> : <CalendarClock className="size-5 text-primary" />}</Card>)}</div>
    <Card className="p-3"><div className="grid gap-3 lg:grid-cols-[auto_minmax(260px,1fr)_220px]">
      <div className="flex flex-wrap gap-2">{tabs.map((item) => <Button key={item.value} type="button" variant={tab === item.value ? 'primary' : 'secondary'} onClick={() => setTab(item.value)}>{item.label} ({counts[item.value]})</Button>)}</div>
      <label className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search lead, mobile, action or notes" /></label>
      <Select value={assignee} onChange={(event) => setAssignee(event.target.value)} aria-label="Filter by assignee"><option value="">All assignees</option>{assignees.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
    </div></Card>
    {selected ? <Card className="border-primary/30 bg-primary/5"><h2 className="font-semibold">Complete follow-up for {selected.person.fullName}</h2><p className="mt-1 text-sm text-muted-foreground">Record the action taken so it remains in the lead history.</p><div className="mt-4 flex flex-col gap-2 sm:flex-row"><Input value={outcome} onChange={(event) => setOutcome(event.target.value)} placeholder="Outcome or action taken" /><Button disabled={!outcome.trim() || complete.isPending} onClick={() => complete.mutate()}>{complete.isPending ? 'Saving...' : 'Complete follow-up'}</Button><Button variant="secondary" onClick={() => { setSelected(null); setOutcome(''); }}>Cancel</Button></div>{complete.isError ? <p className="mt-2 text-sm text-red-600">{complete.error.message}</p> : null}</Card> : null}
    <Card className="overflow-hidden p-0">{query.isLoading ? <RowsSkeleton rows={7} /> : query.isError ? <Empty text="Follow-ups could not be loaded." /> : visible.length === 0 ? <Empty text="No follow-ups in this view." /> : <div className="divide-y divide-border">{visible.map((item) => <article key={item.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="font-medium">{item.person.fullName}</h2><span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold">{item.priority}</span>{tabFor(item) === 'PAST' ? <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">OVERDUE</span> : null}</div><p className="mt-1 text-sm text-muted-foreground">{item.activityType}{item.notes ? ` · ${item.notes}` : ''}</p><p className="mt-1 text-xs text-muted-foreground">Due {formatDateTime(item.dueAt)} · Reminder {formatDateTime(item.reminderAt ?? item.dueAt)} · {item.assignedUser.name} · {item.branch.name}</p></div><div className="flex flex-wrap gap-2"><a href={`tel:${item.person.primaryMobile}`} className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm font-medium hover:bg-muted"><Phone className="size-4" />Call</a>{item.lead ? <Link href={`/leads/${item.lead.id}`} className="inline-flex h-10 items-center rounded-md border border-border px-3 text-sm font-medium hover:bg-muted">Open lead</Link> : null}{!['COMPLETED', 'CANCELLED'].includes(item.status) ? <Button onClick={() => setSelected(item)}>Action taken</Button> : null}</div></article>)}</div>}</Card>
  </section>;
}

function Empty({ text }: { text: string }) { return <div className="p-10 text-center"><BellRing className="mx-auto size-8 text-muted-foreground/40" /><p className="mt-2 text-sm text-muted-foreground">{text}</p></div>; }
