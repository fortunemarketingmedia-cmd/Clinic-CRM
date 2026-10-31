'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CalendarDays, Eraser, Plus, Undo2, X, Zap } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/services/api';
import { useSessionStore } from '@/store/session-store';
import type { ClinicService } from '@/types/appointment';
import type { ChartMarking, Patient360, ProcedureSession } from '@/types/clinical';
import type { StaffMember } from '@/types/front-desk';
import { isTreatmentConsent, usePatientConsents } from './signed-consents';

// Digital version of the clinic's "Stages" sheet: one card per sitting with Date, the face or body diagram with the
// treated area marked, Sitting No, Mode (Free/Fast) and Energy (KJ).
type ChartType = 'FACE' | 'BODY';
const charts: Record<ChartType, { src: string; ratio: number; label: string }> = {
  FACE: { src: '/charts/face-chart.png', ratio: 425 / 410, label: 'Face' },
  BODY: { src: '/charts/body-chart.png', ratio: 709 / 926, label: 'Body (front & back)' },
};
const faceAreas = /face|lip|chin|forehead|forhead|brow|side lock|beard|cheek|jaw|ear lobe|neck|eyes|facial|hifu - (eyes|lower|full face)/i;
const defaultChartFor = (name: string): ChartType => faceAreas.test(name) ? 'FACE' : 'BODY';
const formatDay = (value?: string | null) => value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const toDateInput = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
const sittingOrder = (a: ProcedureSession, b: ProcedureSession) => (a.sittingNumber ?? 0) - (b.sittingNumber ?? 0) || +new Date(a.performedAt ?? a.createdAt) - +new Date(b.performedAt ?? b.createdAt);

export function PatientStagesPanel({ patient, canRecord }: { patient: Patient360; canRecord: boolean }) {
  const consentsQuery = usePatientConsents(patient.id);
  const servicesQuery = useQuery({ queryKey: ['patient-treatment-services', patient.branchId], queryFn: () => apiRequest<{ data: ClinicService[] }>(`/front-desk/services?branchId=${encodeURIComponent(patient.branchId)}`) });
  const sessions = useMemo(() => (patient.procedureSessions ?? []).filter((session) => session.status !== 'CANCELLED'), [patient.procedureSessions]);
  const signedTreatments = useMemo(() => (consentsQuery.data?.data ?? []).filter((record) => isTreatmentConsent(record) && record.status === 'SIGNED' && record.treatmentName).map((record) => record.treatmentName!), [consentsQuery.data?.data]);
  const [extraCourses, setExtraCourses] = useState<string[]>([]);
  const courses = useMemo(() => [...new Set([...sessions.map((session) => session.procedureName), ...signedTreatments, ...extraCourses])], [sessions, signedTreatments, extraCourses]);
  const [selected, setSelected] = useState('');
  const course = courses.includes(selected) ? selected : courses[0] ?? '';
  const [recording, setRecording] = useState(false);
  const treatmentOptions = (servicesQuery.data?.data ?? []).filter((service) => service.active && service.resourceType === 'TREATMENT_ROOM' && !courses.includes(service.name)).sort((a, b) => a.name.localeCompare(b.name));

  const courseSessions = sessions.filter((session) => session.procedureName === course).sort(sittingOrder);
  const chartType: ChartType = courseSessions.at(-1)?.chartType ?? defaultChartFor(course);
  const nextSitting = Math.max(0, ...courseSessions.map((session) => session.sittingNumber ?? 0)) + 1;
  const hasConsent = signedTreatments.includes(course);

  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Treatment stages</p>
        <h2 className="mt-1 text-xl font-semibold">Sitting record chart</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Each sitting is recorded stage by stage: date, the treated area marked on the face or body chart, sitting number, mode and energy.</p>
      </div>
      {canRecord ? <label className="flex items-center gap-2 text-sm">
        <span className="shrink-0 text-muted-foreground">Start another treatment</span>
        <Select className="w-64" value="" onChange={(event) => { if (!event.target.value) return; setExtraCourses((current) => [...current, event.target.value]); setSelected(event.target.value); }} aria-label="Start another treatment">
          <option value="">{servicesQuery.isLoading ? 'Loading treatments…' : 'Choose treatment'}</option>
          {treatmentOptions.map((service) => <option key={service.id} value={service.name}>{service.name}</option>)}
        </Select>
      </label> : null}
    </div>

    {!courses.length ? <Card className="grid min-h-60 place-items-center border-dashed text-center"><div><CalendarDays className="mx-auto size-9 text-primary" /><h3 className="mt-3 font-semibold">No treatment started yet</h3><p className="mt-1 max-w-md text-sm text-muted-foreground">Treatments appear here once the patient signs a consent in the Treatment tab, or choose one above to start its sitting chart.</p></div></Card> : <>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Treatments">{courses.map((name) => {
        const count = sessions.filter((session) => session.procedureName === name).length;
        return <button key={name} type="button" role="tab" aria-selected={name === course} onClick={() => setSelected(name)} className={cn('shrink-0 rounded-xl border px-4 py-2 text-left transition', name === course ? 'border-primary bg-primary/[0.06] ring-1 ring-primary' : 'border-border bg-surface hover:border-primary/40')}>
          <div className="text-sm font-semibold">{name}</div>
          <div className="text-xs text-muted-foreground">{count ? `${count} sitting${count === 1 ? '' : 's'} done` : 'Not started'}</div>
        </button>;
      })}</div>

      <Card className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold">{course}</h3>
            <p className="text-xs text-muted-foreground">{charts[chartType].label} chart · {courseSessions.length} sitting{courseSessions.length === 1 ? '' : 's'} recorded{courseSessions.length ? ` · last on ${formatDay(courseSessions.at(-1)?.performedAt ?? courseSessions.at(-1)?.createdAt)}` : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            {!hasConsent ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800"><AlertTriangle className="size-3.5" />No signed consent</span> : <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">Consent signed</span>}
            {canRecord ? <Button type="button" onClick={() => setRecording(true)}><Plus className="size-4" />Record sitting {nextSitting}</Button> : null}
          </div>
        </div>
        <div className={cn('grid gap-4 p-5', chartType === 'FACE' ? 'sm:grid-cols-2 lg:grid-cols-3' : 'md:grid-cols-2')}>
          {courseSessions.map((session) => <SittingCard key={session.id} session={session} fallbackChart={chartType} />)}
          {canRecord ? <button type="button" onClick={() => setRecording(true)} className="group flex min-h-64 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border p-4 text-muted-foreground transition hover:border-primary/50 hover:text-primary">
            <span className="grid size-10 place-items-center rounded-full bg-muted transition group-hover:bg-primary/10"><Plus className="size-5" /></span>
            <span className="text-sm font-medium">Record sitting {nextSitting}</span>
          </button> : null}
          {!canRecord && !courseSessions.length ? <p className="col-span-full py-10 text-center text-sm text-muted-foreground">No sittings recorded for this treatment yet.</p> : null}
        </div>
      </Card>
    </>}

    {recording && course ? <RecordSittingDialog patient={patient} course={course} defaultChart={chartType} sittingNumber={nextSitting} hasConsent={hasConsent} onClose={() => setRecording(false)} /> : null}
  </div>;
}

function SittingCard({ session, fallbackChart }: { session: ProcedureSession; fallbackChart: ChartType }) {
  const chart = session.chartType ?? fallbackChart;
  const mode = session.deviceParameters?.mode;
  const energy = session.deviceParameters?.energyKj;
  return <article className="rounded-xl border bg-white p-4 text-[#241417] shadow-sm">
    <div className="flex items-center justify-between gap-2 text-sm"><span className="whitespace-nowrap"><span className="text-neutral-500">Date :- </span><b>{formatDay(session.performedAt ?? session.createdAt)}</b></span><span className="shrink-0 whitespace-nowrap rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">Sitting {session.sittingNumber ?? '—'}</span></div>
    <ChartDiagram chart={chart} markings={session.chartMarkings ?? []} className={cn('mx-auto mt-3', chart === 'FACE' ? 'max-w-[220px]' : 'max-w-[260px]')} />
    <dl className="mt-3 space-y-1.5 text-sm">
      <div className="flex gap-2"><dt className="w-24 text-neutral-500">Sitting No :-</dt><dd className="font-semibold">{session.sittingNumber ?? '—'}</dd></div>
      <div className="flex gap-2"><dt className="w-24 text-neutral-500">Mode :-</dt><dd className="flex gap-1">{(['FREE', 'FAST'] as const).map((item) => <span key={item} className={cn('rounded px-1.5 text-xs font-semibold', mode === item ? 'bg-[#241417] text-white' : 'text-neutral-400 line-through decoration-neutral-300')}>{item === 'FREE' ? 'Free' : 'Fast'}</span>)}</dd></div>
      <div className="flex gap-2"><dt className="w-24 text-neutral-500">Energy :-</dt><dd className="font-semibold">{energy != null ? `${energy} KJ` : '—'}</dd></div>
    </dl>
    {session.treatmentArea || session.procedureNotes ? <p className="mt-2 border-t pt-2 text-xs text-neutral-600">{[session.treatmentArea, session.procedureNotes].filter(Boolean).join(' · ')}</p> : null}
    <p className="mt-2 text-[11px] text-neutral-500">By {session.practitioner.name}</p>
  </article>;
}

const strokePath = (points: Array<[number, number]>) => points.length === 1 ? `M${points[0][0]} ${points[0][1]}l0.0001 0` : points.map(([x, y], index) => `${index ? 'L' : 'M'}${x} ${y}`).join('');

function ChartDiagram({ chart, markings, className, children }: { chart: ChartType; markings: ChartMarking[]; className?: string; children?: React.ReactNode }) {
  return <div className={cn('relative w-full select-none', className)} style={{ aspectRatio: charts[chart].ratio }}>
    <img src={charts[chart].src} alt={`${charts[chart].label} chart`} draggable={false} className="absolute inset-0 size-full object-contain" />
    <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
      {markings.map((marking, index) => <path key={index} d={strokePath(marking.points)} fill="none" stroke="rgb(220 38 38 / 0.45)" strokeWidth={chart === 'FACE' ? 14 : 10} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />)}
    </svg>
    {children}
  </div>;
}

function MarkingCanvas({ chart, markings, onChange }: { chart: ChartType; markings: ChartMarking[]; onChange: (markings: ChartMarking[]) => void }) {
  const [current, setCurrent] = useState<Array<[number, number]> | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const point = (event: React.PointerEvent): [number, number] => {
    const rect = ref.current!.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)), Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))].map((value) => Math.round(value * 1000) / 1000) as [number, number];
  };
  const finish = () => { if (current?.length) onChange([...markings, { points: current }]); setCurrent(null); };
  return <div ref={ref} className="touch-none cursor-crosshair" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setCurrent([point(event)]); }} onPointerMove={(event) => { if (!current) return; const next = point(event); const last = current[current.length - 1]; if (Math.hypot(next[0] - last[0], next[1] - last[1]) > 0.004 && current.length < 1000) setCurrent([...current, next]); }} onPointerUp={finish} onPointerCancel={finish}>
    <ChartDiagram chart={chart} markings={current ? [...markings, { points: current }] : markings} />
  </div>;
}

function RecordSittingDialog({ patient, course, defaultChart, sittingNumber, hasConsent, onClose }: { patient: Patient360; course: string; defaultChart: ChartType; sittingNumber: number; hasConsent: boolean; onClose: () => void }) {
  const client = useQueryClient();
  const { session } = useSessionStore();
  const [chart, setChart] = useState<ChartType>(defaultChart);
  const [markings, setMarkings] = useState<ChartMarking[]>([]);
  const [date, setDate] = useState(toDateInput(new Date()));
  const [sitting, setSitting] = useState(String(sittingNumber));
  const [mode, setMode] = useState<'FREE' | 'FAST' | ''>('');
  const [energy, setEnergy] = useState('');
  const [area, setArea] = useState('');
  const [notes, setNotes] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [packageId, setPackageId] = useState('');
  const [consentVerified, setConsentVerified] = useState(hasConsent);

  const staffQuery = useQuery({ queryKey: ['consent-doctors', patient.branchId], queryFn: () => apiRequest<{ data: StaffMember[] }>(`/front-desk/staff?branchId=${encodeURIComponent(patient.branchId)}`) });
  const doctors = (staffQuery.data?.data ?? []).filter((member) => ['ADMIN', 'DOCTOR'].includes(member.role));
  const effectiveDoctorId = doctorId || (doctors.find((member) => member.id === session?.user.id)?.id ?? (doctors.length === 1 ? doctors[0].id : ''));
  const packages = (patient.packages ?? []).filter((item) => (item.status ?? 'ACTIVE') === 'ACTIVE' && item.completedSessions < item.totalSessions);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
  }, [onClose]);

  const sittingValue = Number(sitting);
  const energyValue = energy.trim() === '' ? null : Number(energy);
  const problems = [
    !date && 'Choose the sitting date',
    !(Number.isInteger(sittingValue) && sittingValue >= 1) && 'Enter a valid sitting number',
    !mode && 'Choose the mode (Free or Fast)',
    (energyValue == null || !Number.isFinite(energyValue) || energyValue <= 0) && 'Enter the energy in KJ',
    !markings.length && 'Mark the treated area on the chart',
    !effectiveDoctorId && 'Select the treating doctor',
    !consentVerified && 'Confirm the consent before recording',
  ].filter(Boolean) as string[];

  const save = useMutation({
    mutationFn: () => {
      const now = new Date(); const [year, month, day] = date.split('-').map(Number);
      const performedAt = new Date(year, month - 1, day, now.getHours(), now.getMinutes());
      return apiRequest(`/clinical/patients/${patient.id}/procedure-sessions`, { method: 'POST', body: JSON.stringify({
        branchId: patient.branchId, procedureName: course, practitionerId: effectiveDoctorId, packageId: packageId || undefined,
        treatmentArea: area.trim() || undefined, procedureNotes: notes.trim() || undefined, status: 'COMPLETED', performedAt, consentVerified,
        sittingNumber: sittingValue, chartType: chart, chartMarkings: markings, deviceParameters: { mode, energyKj: energyValue },
      }) });
    },
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['patient-360', patient.id] }); onClose(); },
  });

  return createPortal(<div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={`Record sitting for ${course}`}>
    <button type="button" aria-label="Close" className="absolute inset-0 bg-black/40 animate-fade-in" onClick={onClose} />
    <div className="relative flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-background shadow-2xl animate-fade-in">
      <header className="flex items-start justify-between gap-3 border-b bg-surface px-5 py-4">
        <div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Record sitting</p><h2 className="text-lg font-semibold">{course}</h2></div>
        <Button type="button" variant="ghost" className="size-9 p-0" onClick={onClose} aria-label="Close"><X className="size-5" /></Button>
      </header>
      <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <section>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex rounded-lg border bg-surface p-0.5" role="radiogroup" aria-label="Chart">{(['FACE', 'BODY'] as const).map((item) => <button key={item} type="button" role="radio" aria-checked={chart === item} onClick={() => { if (item !== chart) { setChart(item); setMarkings([]); } }} className={cn('rounded-md px-3 py-1.5 text-xs font-semibold transition', chart === item ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>{charts[item].label}</button>)}</div>
            <div className="flex gap-1">
              <Button type="button" variant="ghost" className="h-8 px-2 text-xs" disabled={!markings.length} onClick={() => setMarkings(markings.slice(0, -1))}><Undo2 className="size-3.5" />Undo</Button>
              <Button type="button" variant="ghost" className="h-8 px-2 text-xs" disabled={!markings.length} onClick={() => setMarkings([])}><Eraser className="size-3.5" />Clear</Button>
            </div>
          </div>
          <div className="mt-3 rounded-xl border bg-white p-4"><div className={cn('mx-auto', chart === 'FACE' ? 'max-w-[360px]' : 'max-w-[380px]')}><MarkingCanvas chart={chart} markings={markings} onChange={setMarkings} /></div></div>
          <p className="mt-2 text-xs text-muted-foreground">Shade the area treated in this sitting with your finger, stylus or mouse.</p>
        </section>
        <section className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1 text-sm"><span className="font-medium">Date</span><Input type="date" value={date} max={toDateInput(new Date())} onChange={(event) => setDate(event.target.value)} /></label>
            <label className="grid gap-1 text-sm"><span className="font-medium">Sitting No</span><Input type="number" min={1} value={sitting} onChange={(event) => setSitting(event.target.value)} /></label>
          </div>
          <div className="grid gap-1 text-sm"><span className="font-medium">Mode</span><div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Mode">{(['FREE', 'FAST'] as const).map((item) => <button key={item} type="button" role="radio" aria-checked={mode === item} onClick={() => setMode(item)} className={cn('h-10 rounded-md border text-sm font-semibold transition', mode === item ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-surface hover:border-primary/40')}>{item === 'FREE' ? 'Free' : 'Fast'}</button>)}</div></div>
          <label className="grid gap-1 text-sm"><span className="font-medium">Energy</span><div className="relative"><Zap className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input type="number" inputMode="decimal" min={0} step="0.1" className="pl-9 pr-10" value={energy} onChange={(event) => setEnergy(event.target.value)} placeholder="0" /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">KJ</span></div></label>
          <label className="grid gap-1 text-sm"><span className="font-medium">Treating doctor</span><Select value={effectiveDoctorId} onChange={(event) => setDoctorId(event.target.value)}><option value="">{staffQuery.isLoading ? 'Loading doctors…' : 'Select doctor'}</option>{doctors.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</Select></label>
          <label className="grid gap-1 text-sm"><span className="font-medium">Area treated <span className="font-normal text-muted-foreground">(optional)</span></span><Input value={area} onChange={(event) => setArea(event.target.value)} placeholder="e.g. Upper lip, chin" /></label>
          {packages.length ? <label className="grid gap-1 text-sm"><span className="font-medium">Count against package <span className="font-normal text-muted-foreground">(optional)</span></span><Select value={packageId} onChange={(event) => setPackageId(event.target.value)}><option value="">Do not deduct a package session</option>{packages.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.totalSessions - item.completedSessions} left</option>)}</Select></label> : null}
          <label className="grid gap-1 text-sm"><span className="font-medium">Notes <span className="font-normal text-muted-foreground">(optional)</span></span><textarea className="min-h-20 rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Skin reaction, patient tolerance, advice" /></label>
          <label className={cn('flex items-start gap-2 rounded-lg border p-3 text-sm', hasConsent ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900')}><input type="checkbox" className="mt-0.5 size-4 accent-[hsl(var(--primary))]" checked={consentVerified} onChange={(event) => setConsentVerified(event.target.checked)} /><span>{hasConsent ? 'Signed consent for this treatment is on file.' : 'No digital consent is signed for this treatment. Tick only if a paper consent has been verified.'}</span></label>
        </section>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t bg-surface px-5 py-3">
        <p className="text-xs text-muted-foreground">{problems[0] ?? 'Ready to save.'}</p>
        <div className="flex gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="button" disabled={problems.length > 0 || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : `Save sitting ${sitting || ''}`}</Button></div>
      </footer>
      {save.isError ? <p role="alert" className="border-t bg-red-50 px-5 py-2 text-sm text-red-700">{save.error.message}</p> : null}
    </div>
  </div>, document.body);
}
