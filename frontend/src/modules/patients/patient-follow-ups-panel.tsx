'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, CalendarClock, CheckCircle2, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { showReminderPopup } from '@/modules/notifications/use-reminder-notifications';
import { apiRequest } from '@/services/api';
import { useSessionStore } from '@/store/session-store';
import type { Patient360 } from '@/types/clinical';
import type { FollowUp } from '@/types/foundation';
import type { StaffMember } from '@/types/front-desk';
import { FollowUpRecordActions } from '../follow-ups/work-record-actions';

// Patient follow-ups: the next check-up call / visit for this patient. Each one shows up in Notifications & Followups
// (and the bell in the top bar) once its reminder time is reached. Marking one done can schedule the next straight away.

const reminderOptions = [
  { value: '1440', label: '1 day before' },
  { value: '2880', label: '2 days before' },
  { value: '10080', label: '1 week before' },
  { value: '120', label: '2 hours before' },
  { value: '15', label: '15 minutes before' },
];
const channelOptions = [
  { value: 'CALL', label: 'Phone call' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'IN_PERSON', label: 'Clinic visit' },
  { value: 'SMS', label: 'SMS' },
  { value: 'EMAIL', label: 'Email' },
];
const closed = (item: FollowUp) => ['COMPLETED', 'CANCELLED'].includes(item.status);
const formatWhen = (value?: string | null) => value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const toLocalInput = (value: Date) => { const date = new Date(value); date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); return date.toISOString().slice(0, 16); };
const defaultNextDate = (days = 30) => { const date = new Date(); date.setDate(date.getDate() + days); date.setHours(11, 0, 0, 0); return toLocalInput(date); };
/** Reminder time for a due date: N minutes before, never in the past. */
const reminderFor = (dueAt: string, minutesBefore: string) => new Date(Math.max(Date.now(), new Date(dueAt).getTime() - Number(minutesBefore) * 60_000)).toISOString();
const channelLabel = (value: string) => channelOptions.find((option) => option.value === value)?.label ?? value.replaceAll('_', ' ').toLowerCase();

export function PatientFollowUpsPanel({ patient }: { patient: Patient360 }) {
  const client = useQueryClient();
  const [scheduling, setScheduling] = useState<{ purpose?: string } | null>(null);
  const [completing, setCompleting] = useState<FollowUp | null>(null);
  const query = useQuery({
    queryKey: ['patient-follow-ups', patient.id],
    queryFn: () => apiRequest<{ data: FollowUp[] }>(`/follow-ups?${new URLSearchParams({ patientId: patient.id, branchId: patient.branchId, scope: 'ALL' })}`),
  });
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['patient-follow-ups', patient.id] });
    void client.invalidateQueries({ queryKey: ['notification-follow-ups'] });
    void client.invalidateQueries({ queryKey: ['header-reminders'] });
  };
  const items = useMemo(() => query.data?.data ?? [], [query.data]);
  const open = items.filter((item) => !closed(item)).sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt));
  const done = items.filter(closed).sort((a, b) => +new Date(b.completedAt ?? b.dueAt) - +new Date(a.completedAt ?? a.dueAt));
  const now = Date.now();
  const next = open[0];

  return <div className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Patient follow-ups</p>
        <h2 className="mt-1 text-xl font-semibold">Next check-up & follow-up calls</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Schedule when the patient should be called or seen next. A notification appears in Notifications & Followups and on the bell when the reminder time is reached.</p>
      </div>
      <Button type="button" onClick={() => setScheduling({})}><Plus className="size-4" />Schedule follow-up</Button>
    </div>

    <div className="grid gap-3 sm:grid-cols-3">
      <Card className="p-4"><div className="text-xs text-muted-foreground">Next follow-up</div><div className="mt-1 text-sm font-semibold">{next ? formatWhen(next.dueAt) : 'Not scheduled'}</div>{next ? <div className="mt-0.5 text-xs text-muted-foreground">{next.activityType}</div> : null}</Card>
      <Card className="p-4"><div className="text-xs text-muted-foreground">Open follow-ups</div><div className="mt-1 text-sm font-semibold">{open.length}</div></Card>
      <Card className="p-4"><div className="text-xs text-muted-foreground">Completed</div><div className="mt-1 text-sm font-semibold">{done.length}</div></Card>
    </div>

    <Card>
      <h3 className="font-semibold">Upcoming & due</h3>
      {query.isLoading ? <p className="py-6 text-center text-sm text-muted-foreground">Loading follow-ups…</p> : query.isError ? <p className="py-6 text-center text-sm text-red-700">{query.error.message}</p> : open.length ? <div className="mt-3 space-y-2">{open.map((item) => {
        const overdue = new Date(item.dueAt).getTime() < now;
        const alerting = !overdue && new Date(item.reminderAt ?? item.dueAt).getTime() <= now;
        return <div key={item.id} className={cn('flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3', overdue && 'border-red-200 bg-red-50/40', alerting && 'border-amber-200 bg-amber-50/40')}>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{item.activityType}</span><span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', overdue ? 'bg-red-100 text-red-700' : alerting ? 'bg-amber-100 text-amber-800' : 'bg-blue-50 text-blue-700')}>{overdue ? 'Overdue' : alerting ? 'Due soon' : 'Upcoming'}</span></div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><CalendarClock className="size-3.5" />{formatWhen(item.dueAt)}</span><span className="inline-flex items-center gap-1"><BellRing className="size-3.5" />Reminder {formatWhen(item.reminderAt ?? item.dueAt)}</span><span>{channelLabel(item.channel)}</span><span>{item.assignedUser.name}</span></div>
            {item.notes ? <p className="mt-1 text-sm">{item.notes}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button type="button" className="h-8 px-2.5 text-xs" onClick={() => setCompleting(item)}><CheckCircle2 className="size-3.5" />Mark done</Button>
            <FollowUpRecordActions followUp={item} onChanged={refresh} />
          </div>
        </div>;
      })}</div> : <div className="py-8 text-center text-sm text-muted-foreground">No follow-up scheduled. Use “Schedule follow-up” to set the next check-up.</div>}
    </Card>

    <Card>
      <h3 className="font-semibold">Completed follow-ups</h3>
      {done.length ? <div className="mt-3 space-y-2">{done.map((item, index) => <div key={item.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{item.activityType}</span><span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">{item.status === 'CANCELLED' ? 'Cancelled' : 'Done'}</span></div>
          <div className="mt-1 text-xs text-muted-foreground">Due {formatWhen(item.dueAt)} · Completed {formatWhen(item.completedAt)}</div>
          {item.outcome ? <p className="mt-1 text-sm"><span className="text-muted-foreground">Outcome:</span> {item.outcome}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {index === 0 && !open.length ? <Button type="button" variant="secondary" className="h-8 px-2.5 text-xs" onClick={() => setScheduling({ purpose: item.activityType })}><Plus className="size-3.5" />Create next follow-up</Button> : null}
          <FollowUpRecordActions followUp={item} onChanged={refresh} />
        </div>
      </div>)}</div> : <p className="py-6 text-center text-sm text-muted-foreground">Nothing completed yet.</p>}
    </Card>

    {scheduling ? <ScheduleFollowUpDialog patient={patient} purpose={scheduling.purpose} onClose={() => setScheduling(null)} onSaved={refresh} /> : null}
    {completing ? <CompleteFollowUpDialog followUp={completing} onClose={() => setCompleting(null)} onSaved={refresh} /> : null}
  </div>;
}

function Dialog({ title, subtitle, onClose, children, footer }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(<div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
    <button type="button" aria-label="Close" className="absolute inset-0 bg-black/40" onClick={onClose} />
    <div className="relative flex max-h-full w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-background shadow-2xl">
      <header className="flex items-start justify-between gap-3 border-b bg-surface px-5 py-4"><div><h2 className="text-lg font-semibold">{title}</h2>{subtitle ? <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p> : null}</div><Button type="button" variant="ghost" className="size-9 p-0" onClick={onClose} aria-label="Close"><X className="size-5" /></Button></header>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      <footer className="flex flex-wrap items-center justify-end gap-2 border-t bg-surface px-5 py-3">{footer}</footer>
    </div>
  </div>, document.body);
}

function Field({ label, required, children, className }: { label: string; required?: boolean; children: React.ReactNode; className?: string }) {
  return <label className={cn('grid gap-1 text-sm', className)}><span className="font-medium">{label}{required ? <span className="text-red-600"> *</span> : null}</span>{children}</label>;
}

function useBranchStaff(branchId: string) {
  const { session } = useSessionStore();
  const staffQuery = useQuery({ queryKey: ['task-assignees', branchId], queryFn: () => apiRequest<{ data: StaffMember[] }>(`/front-desk/staff?branchId=${encodeURIComponent(branchId)}`) });
  const staff = staffQuery.data?.data ?? [];
  const defaultId = staff.find((member) => member.id === session?.user.id)?.id ?? staff[0]?.id ?? '';
  return { staff, defaultId, loading: staffQuery.isLoading };
}

function ScheduleFollowUpDialog({ patient, purpose, onClose, onSaved }: { patient: Patient360; purpose?: string; onClose: () => void; onSaved: () => void }) {
  const { staff, defaultId, loading } = useBranchStaff(patient.branchId);
  const [form, setForm] = useState({ activityType: purpose ?? 'Check-up follow-up', dueAt: defaultNextDate(), remind: '1440', channel: 'CALL', priority: 'MEDIUM', assignedUserId: '', notes: '' });
  const assignedUserId = form.assignedUserId || defaultId;
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const missing = [!form.activityType.trim() && 'purpose', !form.dueAt && 'date & time', !assignedUserId && 'who will follow up'].filter(Boolean) as string[];
  const save = useMutation({
    mutationFn: () => apiRequest<{ data: FollowUp }>('/follow-ups', { method: 'POST', body: JSON.stringify({
      patientId: patient.id, branchId: patient.branchId, assignedUserId, activityType: form.activityType.trim(), channel: form.channel,
      direction: 'OUTBOUND', dueAt: new Date(form.dueAt).toISOString(), reminderAt: reminderFor(form.dueAt, form.remind),
      priority: form.priority, notes: form.notes.trim() || undefined, source: 'PATIENT_FOLLOW_UP',
    }) }),
    onSuccess: ({ data }) => {
      showReminderPopup({
        key: `assigned-followup-${data.id}`,
        kind: 'Followup',
        title: 'Follow-up scheduled',
        detail: `${patient.fullName} · ${data.activityType}`,
        dueAt: data.dueAt,
      });
      onSaved();
      onClose();
    },
  });
  return <Dialog title="Schedule follow-up" subtitle={`${patient.fullName} · ${patient.mobile}`} onClose={onClose} footer={<>
    {missing.length ? <p className="mr-auto text-xs text-muted-foreground">Still needed: {missing.join(', ')}</p> : null}
    <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
    <Button type="button" disabled={missing.length > 0 || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : 'Save follow-up'}</Button>
  </>}>
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Purpose" required className="sm:col-span-2"><Input value={form.activityType} onChange={(event) => set('activityType', event.target.value)} placeholder="e.g. Check-up after HIFU sitting 2" /></Field>
      <Field label="Follow-up date & time" required><Input type="datetime-local" value={form.dueAt} onChange={(event) => set('dueAt', event.target.value)} /></Field>
      <Field label="Notify the team"><Select value={form.remind} onChange={(event) => set('remind', event.target.value)}>{reminderOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></Field>
      <Field label="How"><Select value={form.channel} onChange={(event) => set('channel', event.target.value)}>{channelOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></Field>
      <Field label="Priority"><Select value={form.priority} onChange={(event) => set('priority', event.target.value)}><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="URGENT">Urgent</option></Select></Field>
      <Field label="Who will follow up" required className="sm:col-span-2"><Select value={assignedUserId} onChange={(event) => set('assignedUserId', event.target.value)}><option value="">{loading ? 'Loading team…' : 'Select team member'}</option>{staff.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</Select></Field>
      <Field label="Notes (optional)" className="sm:col-span-2"><textarea className="min-h-20 rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" value={form.notes} onChange={(event) => set('notes', event.target.value)} placeholder="What to check or ask the patient" /></Field>
    </div>
    {form.dueAt ? <p className="mt-4 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground"><BellRing className="mr-1 inline size-3.5" />The notification will appear on {formatWhen(reminderFor(form.dueAt, form.remind))}.</p> : null}
    {save.isError ? <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{save.error.message}</p> : null}
  </Dialog>;
}

function CompleteFollowUpDialog({ followUp, onClose, onSaved }: { followUp: FollowUp; onClose: () => void; onSaved: () => void }) {
  const [outcome, setOutcome] = useState('');
  const [scheduleNext, setScheduleNext] = useState(true);
  const [next, setNext] = useState({ purpose: followUp.activityType, dueAt: defaultNextDate(), remind: '1440' });
  const missing = [!outcome.trim() && 'what happened', scheduleNext && !next.purpose.trim() && 'next purpose', scheduleNext && !next.dueAt && 'next date & time'].filter(Boolean) as string[];
  const save = useMutation({
    mutationFn: () => apiRequest(`/follow-ups/${followUp.id}/complete`, { method: 'POST', body: JSON.stringify(scheduleNext
      ? { outcome: outcome.trim(), notes: outcome.trim(), resolution: 'NEXT_ACTION', nextAction: next.purpose.trim(), nextFollowUpAt: new Date(next.dueAt).toISOString(), nextReminderAt: reminderFor(next.dueAt, next.remind) }
      : { outcome: outcome.trim(), notes: outcome.trim(), resolution: 'CLOSED' }) }),
    onSuccess: () => { onSaved(); onClose(); },
  });
  return <Dialog title="Mark follow-up done" subtitle={`${followUp.activityType} · due ${formatWhen(followUp.dueAt)}`} onClose={onClose} footer={<>
    {missing.length ? <p className="mr-auto text-xs text-muted-foreground">Still needed: {missing.join(', ')}</p> : null}
    <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
    <Button type="button" disabled={missing.length > 0 || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : scheduleNext ? 'Done & schedule next' : 'Mark done'}</Button>
  </>}>
    <Field label="What happened" required><textarea className="min-h-20 rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" value={outcome} onChange={(event) => setOutcome(event.target.value)} placeholder="e.g. Patient came for check-up, skin healing well" /></Field>
    <label className="mt-4 flex items-center gap-2 text-sm font-medium"><input type="checkbox" className="size-4 accent-[hsl(var(--primary))]" checked={scheduleNext} onChange={(event) => setScheduleNext(event.target.checked)} />Create the next follow-up</label>
    {scheduleNext ? <div className="mt-3 grid gap-4 rounded-xl border bg-muted/30 p-4 sm:grid-cols-2">
      <Field label="Next purpose" required className="sm:col-span-2"><Input value={next.purpose} onChange={(event) => setNext((current) => ({ ...current, purpose: event.target.value }))} /></Field>
      <Field label="Next date & time" required><Input type="datetime-local" value={next.dueAt} onChange={(event) => setNext((current) => ({ ...current, dueAt: event.target.value }))} /></Field>
      <Field label="Notify the team"><Select value={next.remind} onChange={(event) => setNext((current) => ({ ...current, remind: event.target.value }))}>{reminderOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></Field>
      <p className="text-xs text-muted-foreground sm:col-span-2">Same person, channel and priority as this follow-up.</p>
    </div> : null}
    {save.isError ? <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{save.error.message}</p> : null}
  </Dialog>;
}
