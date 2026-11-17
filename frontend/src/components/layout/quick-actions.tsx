'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, CheckCircle2, ExternalLink, ListChecks, UserPlus, X } from 'lucide-react';
import Link from 'next/link';
import { createContext, useCallback, useContext, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { StatusBadge, type StatusTone } from '@/components/ui/status-badge';
import { apiRequest } from '@/services/api';
import { useSessionStore } from '@/store/session-store';
import type { Branch } from '@/types/branch';

export type QuickAction = 'lead' | 'appointment' | 'queue';
const QuickActionContext = createContext<(action: QuickAction) => void>(() => undefined);
export const useQuickAction = () => useContext(QuickActionContext);

/** Hosts the quick-action dialogs so they can be opened from any page without leaving it. */
export function QuickActionProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<QuickAction | null>(null);
  const close = useCallback(() => setActive(null), []);
  const value = useMemo(() => setActive, []);
  return (
    <QuickActionContext.Provider value={value}>
      {children}
      {active === 'lead' ? <QuickLeadDialog onClose={close} /> : null}
      {active === 'appointment' ? <QuickAppointmentDialog onClose={close} /> : null}
      {active === 'queue' ? <QuickQueueDrawer onClose={close} /> : null}
    </QuickActionContext.Provider>
  );
}

function Shell({ title, description, onClose, children, side = false }: { title: string; description: string; onClose: () => void; children: ReactNode; side?: boolean }) {
  return createPortal(
    <div className={side ? 'fixed inset-0 z-50 flex justify-end' : 'fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6'} role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/45" onClick={onClose} />
      <div className={side ? 'relative flex h-full w-full max-w-md flex-col bg-background shadow-2xl' : 'relative flex max-h-full w-full max-w-xl flex-col overflow-hidden rounded-[20px] bg-background shadow-2xl'}>
        <div className="flex items-start justify-between gap-4 border-b border-border bg-surface px-5 py-4 sm:px-6">
          <div><h2 className="text-lg font-semibold">{title}</h2><p className="text-[13px] text-muted-foreground">{description}</p></div>
          <button type="button" aria-label="Close" onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: ReactNode }) {
  return <label className="block space-y-1.5"><span className="text-sm font-medium">{label}{required ? <span className="text-red-600" aria-hidden> *</span> : null}</span>{children}{error ? <span role="alert" className="block text-xs text-red-600">{error}</span> : null}</label>;
}

function useBranches() {
  const { selectedBranchId } = useSessionStore();
  const query = useQuery({ queryKey: ['branches'], queryFn: () => apiRequest<{ data: Branch[] }>('/branches') });
  const branches = query.data?.data ?? [];
  const defaultBranch = branches.find((branch) => branch.id === selectedBranchId)?.id ?? branches[0]?.id ?? '';
  return { branches, defaultBranch };
}

const sources = [['PHONE_CALL', 'Phone call'], ['WALK_IN', 'Walk-in'], ['WHATSAPP', 'WhatsApp'], ['WEBSITE', 'Website'], ['GOOGLE_ADS', 'Google Ads'], ['META_ADS', 'Meta Ads'], ['OTHER', 'Other']] as const;

function QuickLeadDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const { branches, defaultBranch } = useBranches();
  const [form, setForm] = useState({ name: '', mobile: '', email: '', source: 'PHONE_CALL', branchId: '', interestedTreatment: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const create = useMutation({
    mutationFn: () => apiRequest<{ data: { id: string; name: string } }>('/leads', { method: 'POST', body: JSON.stringify({ name: form.name.trim(), mobile: form.mobile.trim(), email: form.email.trim() || undefined, source: form.source, priority: 'MEDIUM', branchId: form.branchId || defaultBranch, interestedTreatment: form.interestedTreatment.trim() || undefined }) }),
    onSuccess: () => queryClient.invalidateQueries(),
  });
  const set = (key: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [key]: value }));

  function submit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (form.name.trim().length < 2) next.name = 'Name is required';
    if (form.mobile.trim().length < 8) next.mobile = 'Enter a valid mobile number';
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) next.email = 'Enter a valid email address';
    setErrors(next);
    if (!Object.keys(next).length) create.mutate();
  }

  if (create.isSuccess) {
    return <Shell title="Lead added" description="The enquiry is now in your lead list." onClose={onClose}>
      <div className="flex flex-col items-center gap-3 py-6 text-center"><span className="grid size-12 place-items-center rounded-full bg-success-soft text-success"><CheckCircle2 className="size-6" aria-hidden /></span><p className="font-medium">{create.data.data.name} was added.</p>
        <div className="flex flex-wrap justify-center gap-2"><Link href={`/leads/${create.data.data.id}`} onClick={onClose} className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-white hover:bg-primary-hover">Open lead<ExternalLink className="size-4" aria-hidden /></Link><Button type="button" variant="secondary" onClick={() => { create.reset(); setForm({ name: '', mobile: '', email: '', source: form.source, branchId: form.branchId, interestedTreatment: '' }); }}>Add another</Button></div></div>
    </Shell>;
  }
  return <Shell title="Add lead" description="Capture the essentials now; add details later from the lead profile." onClose={onClose}>
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit} noValidate>
      <Field label="Name" required error={errors.name}><Input autoFocus value={form.name} onChange={(event) => set('name')(event.target.value)} autoComplete="off" /></Field>
      <Field label="Mobile" required error={errors.mobile}><Input value={form.mobile} inputMode="tel" onChange={(event) => set('mobile')(event.target.value)} autoComplete="off" /></Field>
      <Field label="Email" error={errors.email}><Input type="email" value={form.email} onChange={(event) => set('email')(event.target.value)} /></Field>
      <Field label="Source" required><Select value={form.source} onChange={(event) => set('source')(event.target.value)}>{sources.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
      <Field label="Branch" required><Select value={form.branchId || defaultBranch} onChange={(event) => set('branchId')(event.target.value)}>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</Select></Field>
      <Field label="Interested treatment"><Input value={form.interestedTreatment} onChange={(event) => set('interestedTreatment')(event.target.value)} placeholder="Service the client asked about" /></Field>
      {create.isError ? <p role="alert" className="text-sm text-red-700 sm:col-span-2">{create.error.message}</p> : null}
      <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" loading={create.isPending}><UserPlus className="size-4" />Add lead</Button></div>
    </form>
  </Shell>;
}

function QuickAppointmentDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const { branches, defaultBranch } = useBranches();
  const [form, setForm] = useState({ name: '', mobile: '', source: 'PHONE_CALL', branchId: '', appointmentAt: '', appointmentType: 'CLINIC_VISIT', notes: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const create = useMutation({
    mutationFn: () => apiRequest<{ data: { id: string } }>('/appointments', { method: 'POST', body: JSON.stringify({ name: form.name.trim(), mobile: form.mobile.trim(), source: form.source, branchId: form.branchId || defaultBranch, appointmentAt: form.appointmentAt, appointmentType: form.appointmentType, resourceType: 'CONSULTATION', bookingPlan: 'CONSULTATION', durationMinutes: 30, bufferMinutes: 10, paymentStatus: 'NOT_PAID', notes: form.notes.trim() || undefined }) }),
    onSuccess: () => queryClient.invalidateQueries(),
  });
  const set = (key: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [key]: value }));

  function submit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (form.name.trim().length < 2) next.name = 'Name is required';
    if (form.mobile.trim().length < 8) next.mobile = 'Enter a valid mobile number';
    if (!form.appointmentAt) next.appointmentAt = 'Choose a date and time';
    setErrors(next);
    if (!Object.keys(next).length) create.mutate();
  }

  if (create.isSuccess) {
    return <Shell title="Appointment booked" description="It now appears on the calendar." onClose={onClose}>
      <div className="flex flex-col items-center gap-3 py-6 text-center"><span className="grid size-12 place-items-center rounded-full bg-success-soft text-success"><CheckCircle2 className="size-6" aria-hidden /></span><p className="font-medium">Consultation booked for {form.name}.</p>
        <div className="flex flex-wrap justify-center gap-2"><Link href="/appointments" onClick={onClose} className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-white hover:bg-primary-hover">View calendar<ExternalLink className="size-4" aria-hidden /></Link><Button type="button" variant="secondary" onClick={() => { create.reset(); setForm({ ...form, name: '', mobile: '', appointmentAt: '', notes: '' }); }}>Book another</Button></div></div>
    </Shell>;
  }
  return <Shell title="Book appointment" description="Standard 30-minute consultation. Treatment-room bookings are made from Schedules & Rooms." onClose={onClose}>
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit} noValidate>
      <Field label="Client name" required error={errors.name}><Input autoFocus value={form.name} onChange={(event) => set('name')(event.target.value)} autoComplete="off" /></Field>
      <Field label="Mobile" required error={errors.mobile}><Input value={form.mobile} inputMode="tel" onChange={(event) => set('mobile')(event.target.value)} autoComplete="off" /></Field>
      <Field label="Branch" required><Select value={form.branchId || defaultBranch} onChange={(event) => set('branchId')(event.target.value)}>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</Select></Field>
      <Field label="Date & time" required error={errors.appointmentAt}><Input type="datetime-local" value={form.appointmentAt} onChange={(event) => set('appointmentAt')(event.target.value)} /></Field>
      <Field label="Visit type"><Select value={form.appointmentType} onChange={(event) => set('appointmentType')(event.target.value)}><option value="CLINIC_VISIT">In-clinic consultation</option><option value="VIDEO_CONSULTATION">Video consultation</option></Select></Field>
      <Field label="Source"><Select value={form.source} onChange={(event) => set('source')(event.target.value)}>{sources.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
      <div className="sm:col-span-2"><Field label="Notes"><Input value={form.notes} onChange={(event) => set('notes')(event.target.value)} placeholder="Optional" /></Field></div>
      {create.isError ? <p role="alert" className="text-sm text-red-700 sm:col-span-2">{create.error.message}</p> : null}
      <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" loading={create.isPending}><CalendarPlus className="size-4" />Book appointment</Button></div>
    </form>
  </Shell>;
}

type QueueRow = { id: string; appointmentAt: string; status: string; queueStage?: string; lead?: { name: string; mobile: string } | null; doctor?: { name: string } | null };
const queueTone = (status: string): StatusTone => status === 'IN_CONSULTATION' ? 'info' : status === 'WAITING' ? 'warning' : 'neutral';

function QuickQueueDrawer({ onClose }: { onClose: () => void }) {
  const { selectedBranchId } = useSessionStore();
  const { branches } = useBranches();
  const branchId = selectedBranchId || '';
  const query = useQuery({
    queryKey: ['quick-queue', branchId],
    queryFn: () => apiRequest<{ data: QueueRow[] }>(`/front-desk/today-queue?${new URLSearchParams({ branchId }).toString()}`),
    enabled: Boolean(branchId),
    refetchInterval: 20_000,
  });
  const rows = query.data?.data ?? [];
  const branchName = branches.find((branch) => branch.id === branchId)?.name;
  return <Shell side title="Today's client queue" description={branchName ? `${branchName} · refreshes automatically` : 'Choose a branch to see its queue'} onClose={onClose}>
    {!branchId ? <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">The queue is shown one branch at a time. Pick a branch from the selector in the top bar, then reopen this panel.</p>
      : query.isLoading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading queue…</p>
      : query.isError ? <p role="alert" className="py-8 text-center text-sm text-red-700">The queue could not be loaded.</p>
      : !rows.length ? <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No clients are waiting or in consultation right now.</p>
      : <ul className="divide-y divide-border">{rows.map((row, index) => <li key={row.id} className="flex items-center gap-3 py-3"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-primary">{index + 1}</span><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{row.lead?.name ?? 'Client'}</div><div className="truncate text-xs text-muted-foreground">{new Date(row.appointmentAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}{row.doctor?.name ? ` · ${row.doctor.name}` : ''}</div></div><StatusBadge tone={queueTone(row.status)} className="capitalize">{row.status.replaceAll('_', ' ').toLowerCase()}</StatusBadge></li>)}</ul>}
    <Link href="/daily-client-queue" onClick={onClose} className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-medium text-white hover:bg-primary-hover"><ListChecks className="size-4" aria-hidden />Open full queue</Link>
  </Shell>;
}
