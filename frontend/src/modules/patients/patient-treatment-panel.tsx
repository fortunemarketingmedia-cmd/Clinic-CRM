'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CalendarClock, Check, CheckCircle2, ChevronRight, Clipboard, Clock3, Eye, FileSignature, Link2, MessageCircle, PenLine, Plus, RotateCw, Search, ShieldCheck, Unlink, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { SignaturePad } from '@/components/ui/signature-pad';
import { cn } from '@/lib/utils';
import { consentKeysForTreatment, generalConsentKey, parseConsentText } from '@/lib/treatment-consents';
import { apiRequest } from '@/services/api';
import { useSessionStore } from '@/store/session-store';
import type { ClinicService } from '@/types/appointment';
import type { Patient360 } from '@/types/clinical';
import type { ConsentRecord, ConsentTemplate } from '@/types/forms';
import type { StaffMember } from '@/types/front-desk';
import { CourseSittings } from './patient-stages-panel';
import { ConsentStatusChip, SignedConsentDocument, SignedConsentViewer, isTreatmentConsent, usePatientConsents } from './signed-consents';

const formatDateTime = (value?: string | null) => value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '-';
const formatDate = (value: Date | string) => new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
const formatSex = (value?: string | null) => value ? value.charAt(0) + value.slice(1).toLowerCase() : 'Not recorded';
const shortFormName = (template: ConsentTemplate) => template.key === generalConsentKey ? 'General consent' : template.name.replace(/^Informed consent (for|of) /i, '').replace(/ Consent Form$/i, '');
const doctorRoles = ['ADMIN', 'DOCTOR'];

/** The clinic's stored doctor signature, applied to consents by the server. */
function useDoctorSignature() {
  const query = useQuery({ queryKey: ['doctor-signature'], queryFn: () => apiRequest<{ data: { dataUrl: string } }>('/consents/doctor-signature'), staleTime: 3_600_000 });
  return query.data?.data.dataUrl ?? '';
}

function DoctorSignatureBox({ signature }: { signature: string }) {
  return <div className="flex h-28 items-center justify-center rounded-xl border border-border bg-white p-3">
    {signature ? <img src={signature} alt="Treating doctor's signature on file" className="max-h-full max-w-[220px] object-contain" /> : <span className="text-xs text-muted-foreground">Loading signature…</span>}
  </div>;
}

type ConsentStep = 'SIGNED' | 'PENDING' | 'REQUIRED';

/**
 * One workspace per patient treatment: choose the treatment, complete its informed consent (the doctor's signature is
 * applied automatically), then record sittings. Sittings stay locked until the consent is signed.
 */
export function PatientTreatmentPanel({ patient, canRecord }: { patient: Patient360; canRecord: boolean }) {
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [extraCourses, setExtraCourses] = useState<string[]>([]);
  const [selected, setSelected] = useState('');
  const [consentFor, setConsentFor] = useState('');
  const [viewing, setViewing] = useState<ConsentRecord | null>(null);
  const [completing, setCompleting] = useState<ConsentRecord | null>(null);

  const servicesQuery = useQuery({ queryKey: ['patient-treatment-services', patient.branchId], queryFn: () => apiRequest<{ data: ClinicService[] }>(`/front-desk/services?branchId=${encodeURIComponent(patient.branchId)}`) });
  const templatesQuery = useQuery({ queryKey: ['patient-consent-templates', patient.branchId], queryFn: () => apiRequest<{ data: ConsentTemplate[] }>(`/consents/templates?branchId=${encodeURIComponent(patient.branchId)}`) });
  const recordsQuery = usePatientConsents(patient.id);

  const treatments = useMemo(() => (servicesQuery.data?.data ?? [])
    .filter((service) => service.active && service.resourceType === 'TREATMENT_ROOM')
    .sort((a, b) => (a.category ?? '').localeCompare(b.category ?? '') || a.name.localeCompare(b.name)), [servicesQuery.data?.data]);
  const templatesByKey = useMemo(() => new Map((templatesQuery.data?.data ?? []).filter((template) => template.status === 'PUBLISHED').map((template) => [template.key, template])), [templatesQuery.data?.data]);
  const procedureRecords = useMemo(() => (recordsQuery.data?.data ?? []).filter(isTreatmentConsent), [recordsQuery.data?.data]);
  const sessions = useMemo(() => (patient.procedureSessions ?? []).filter((session) => session.status !== 'CANCELLED'), [patient.procedureSessions]);

  const courses = useMemo(() => [...new Set([
    ...sessions.map((session) => session.procedureName),
    ...procedureRecords.map((record) => record.treatmentName).filter((name): name is string => Boolean(name)),
    ...extraCourses,
  ])], [sessions, procedureRecords, extraCourses]);
  const course = courses.includes(selected) ? selected : courses[0] ?? '';
  const stepOf = (name: string): ConsentStep => {
    const own = procedureRecords.filter((record) => record.treatmentName === name);
    return own.some((record) => record.status === 'SIGNED') ? 'SIGNED' : own.some((record) => record.status === 'PENDING') ? 'PENDING' : 'REQUIRED';
  };
  const courseRecords = procedureRecords.filter((record) => record.treatmentName === course);
  const step = course ? stepOf(course) : 'REQUIRED';
  const pendingRecord = courseRecords.find((record) => record.status === 'PENDING');
  const signedRecord = courseRecords.find((record) => record.status === 'SIGNED');
  const sittingCount = (name: string) => sessions.filter((session) => session.procedureName === name).length;
  const service = treatments.find((item) => item.name === course);
  const consentService = treatments.find((item) => item.name === consentFor);

  const consentTone = (value: ConsentStep) => value === 'SIGNED' ? 'success' as const : value === 'PENDING' ? 'warning' as const : 'neutral' as const;
  const consentLabel = (value: ConsentStep) => value === 'SIGNED' ? 'Consent signed' : value === 'PENDING' ? 'Doctor signature pending' : 'Consent required';

  function chooseTreatment(name: string) {
    setExtraCourses((current) => current.includes(name) ? current : [...current, name]);
    setSelected(name);
    setCatalogOpen(false);
    if (stepOf(name) === 'REQUIRED') setConsentFor(name);
  }

  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-xl font-semibold">Treatment plan</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Choose a treatment, sign its informed consent, then record the sittings — all in one place for {patient.fullName}.</p>
      </div>
      {canRecord ? <Button type="button" onClick={() => setCatalogOpen(true)}><Plus className="size-4" />Add treatment</Button> : null}
    </div>

    {!courses.length ? <Card className="grid min-h-56 place-items-center border-dashed text-center">
      <div><FileSignature className="mx-auto size-9 text-primary" aria-hidden /><h3 className="mt-3 font-semibold">No treatment started yet</h3><p className="mt-1 max-w-md text-sm text-muted-foreground">Use “Add treatment” to choose a service. Its consent form opens next, and sittings unlock once it is signed.</p></div>
    </Card> : <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
      <ul className="max-h-[560px] space-y-2 overflow-y-auto pr-1" aria-label="Treatments">
        {courses.map((name) => {
          const state = stepOf(name);
          return <li key={name}>
            <button type="button" onClick={() => setSelected(name)} aria-current={name === course} className={cn('w-full rounded-2xl border bg-surface p-3.5 text-left shadow-card transition-colors', name === course ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-primary/40')}>
              <div className="text-sm font-semibold">{name}</div>
              <div className="mt-2 flex flex-wrap items-center gap-2"><StatusBadge tone={consentTone(state)}>{consentLabel(state)}</StatusBadge><span className="text-xs text-muted-foreground">{sittingCount(name)} sitting{sittingCount(name) === 1 ? '' : 's'}</span></div>
            </button>
          </li>;
        })}
      </ul>

      <Card className="space-y-6 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h3 className="text-lg font-semibold">{course}</h3><p className="text-[13px] text-muted-foreground">{[service?.category, service ? `${service.durationMinutes} min` : null, service?.basePrice != null ? `₹${Number(service.basePrice).toLocaleString('en-IN')}` : null].filter(Boolean).join(' · ') || 'Treatment details'}</p></div>
          <ol className="flex items-center gap-2 text-xs font-medium" aria-label="Progress">
            <li className="flex items-center gap-1.5 text-success"><CheckCircle2 className="size-4" aria-hidden />Chosen</li>
            <li aria-hidden className="h-px w-5 bg-border" />
            <li className={cn('flex items-center gap-1.5', step === 'SIGNED' ? 'text-success' : 'text-amber-700')}>{step === 'SIGNED' ? <CheckCircle2 className="size-4" aria-hidden /> : <Clock3 className="size-4" aria-hidden />}Consent</li>
            <li aria-hidden className="h-px w-5 bg-border" />
            <li className={cn('flex items-center gap-1.5', step === 'SIGNED' ? 'text-primary' : 'text-muted-foreground')}><CalendarClock className="size-4" aria-hidden />Sittings</li>
          </ol>
        </div>

        <section aria-label="Informed consent" className="rounded-2xl bg-muted/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-white text-primary shadow-card"><ShieldCheck className="size-5" aria-hidden /></span><div><div className="text-sm font-semibold">Informed consent</div><div className="text-xs text-muted-foreground">{step === 'SIGNED' && signedRecord ? `Signed ${formatDateTime(signedRecord.signedAt)}${signedRecord.doctorName ? ` · ${signedRecord.doctorName}` : ''}` : step === 'PENDING' ? 'Patient has signed. The doctor’s signature completes the form.' : 'Required before the first sitting.'}</div></div></div>
            <div className="flex flex-wrap gap-2">
              {step === 'SIGNED' && signedRecord ? <Button type="button" variant="secondary" onClick={() => setViewing(signedRecord)}><Eye className="size-4" />View consent</Button> : null}
              {step === 'PENDING' && pendingRecord ? <Button type="button" onClick={() => setCompleting(pendingRecord)}><PenLine className="size-4" />Apply doctor signature</Button> : null}
              {step === 'REQUIRED' && canRecord && service ? <Button type="button" onClick={() => setConsentFor(course)}><FileSignature className="size-4" />Open consent form</Button> : null}
              {step === 'REQUIRED' && canRecord && !service ? <span className="text-xs text-muted-foreground">This treatment is no longer in the service list.</span> : null}
            </div>
          </div>
          {courseRecords.length > 1 || (courseRecords.length === 1 && step !== 'SIGNED') ? <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-white text-sm">{courseRecords.map((record) => <li key={record.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"><span className="flex items-center gap-2"><ConsentStatusChip status={record.status} /><span className="text-xs text-muted-foreground">{record.template.name} · v{record.templateVersion} · {formatDateTime(record.signedAt)}</span></span><Button type="button" variant="ghost" className="h-8 px-3 text-xs" onClick={() => setViewing(record)}>View</Button></li>)}</ul> : null}
        </section>

        <CourseSittings patient={patient} course={course} canRecord={canRecord} hasConsent={step === 'SIGNED'} />
      </Card>
    </div>}

    {catalogOpen ? <TreatmentCatalog treatments={treatments} loading={servicesQuery.isLoading} error={servicesQuery.error?.message} templatesByKey={templatesByKey} signedNames={new Set(procedureRecords.filter((record) => record.status === 'SIGNED').map((record) => record.treatmentName ?? ''))} onPick={chooseTreatment} onClose={() => setCatalogOpen(false)} /> : null}
    {viewing ? <SignedConsentViewer record={viewing} patient={patient} onClose={() => setViewing(null)} /> : null}
    {completing ? <DoctorCountersignDialog patient={patient} record={completing} onClose={() => setCompleting(null)} onCompleted={() => { setCompleting(null); recordsQuery.refetch(); }} /> : null}
    {consentService ? <ConsentDrawer key={consentService.id} patient={patient} service={consentService} templatesByKey={templatesByKey} templatesLoading={templatesQuery.isLoading} records={procedureRecords} onClose={() => { setConsentFor(''); recordsQuery.refetch(); }} /> : null}
  </div>;
}

/** Searchable, paged catalogue of treatment services. Picking one starts its consent. */
function TreatmentCatalog({ treatments, loading, error, templatesByKey, signedNames, onPick, onClose }: { treatments: ClinicService[]; loading: boolean; error?: string; templatesByKey: Map<string, ConsentTemplate>; signedNames: Set<string>; onPick: (name: string) => void; onClose: () => void }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [page, setPage] = useState(1);
  const pageSize = 12;
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const service of treatments) counts.set(service.category || 'Other treatments', (counts.get(service.category || 'Other treatments') ?? 0) + 1);
    return [...counts.entries()];
  }, [treatments]);
  const filtered = treatments.filter((service) => (category === 'All' || (service.category || 'Other treatments') === category) && `${service.name} ${service.category ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()));
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * pageSize, current * pageSize);

  return createPortal(<div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Add treatment">
    <button type="button" aria-label="Close" className="absolute inset-0 bg-black/45" onClick={onClose} />
    <div className="relative flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-[20px] bg-background shadow-2xl">
      <div className="flex items-start justify-between gap-4 border-b border-border bg-surface px-5 py-4 sm:px-6">
        <div><h2 className="text-lg font-semibold">Add treatment</h2><p className="text-[13px] text-muted-foreground">Choose a service. Its informed consent form opens next.</p></div>
        <button type="button" aria-label="Close" onClick={onClose} className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
      </div>
      <div className="space-y-3 border-b border-border bg-surface px-5 py-3 sm:px-6">
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" aria-hidden /><Input className="pl-9" placeholder="Search treatments, e.g. HIFU, peel, laser hair" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></div>
        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Categories">
          {[['All', treatments.length] as const, ...categories].map(([name, count]) => <button key={name} type="button" role="tab" aria-selected={category === name} onClick={() => { setCategory(name); setPage(1); }} className={cn('shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors', category === name ? 'bg-deep text-white' : 'bg-muted text-muted-foreground hover:bg-primary-soft')}>{name} <span className="opacity-70">{count}</span></button>)}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        {loading ? <p className="py-10 text-center text-sm text-muted-foreground">Loading treatments…</p> : null}
        {error ? <p className="py-10 text-center text-sm text-red-700">{error}</p> : null}
        {!loading && !error && !visible.length ? <p className="py-10 text-center text-sm text-muted-foreground">No treatments match “{search}”.</p> : null}
        <ul className="grid gap-2 sm:grid-cols-2">
          {visible.map((service) => {
            const forms = consentKeysForTreatment(service.name).map((key) => templatesByKey.get(key)).filter((template): template is ConsentTemplate => Boolean(template));
            return <li key={service.id}><button type="button" onClick={() => onPick(service.name)} className="group flex w-full items-center gap-3 rounded-2xl border border-border bg-surface p-3 text-left transition-colors hover:border-primary/50 hover:bg-primary-soft/40">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary"><FileSignature className="size-4" aria-hidden /></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{service.name}</span><span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><Clock3 className="size-3" aria-hidden />{service.durationMinutes} min</span>{service.basePrice != null ? <span>₹{Number(service.basePrice).toLocaleString('en-IN')}</span> : null}{forms[0] ? <span className="truncate">{shortFormName(forms[0])}</span> : null}</span></span>
              {signedNames.has(service.name) ? <StatusBadge tone="success" className="hidden shrink-0 sm:inline-flex">Consent on file</StatusBadge> : null}
              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
            </button></li>;
          })}
        </ul>
      </div>
      <div className="flex items-center justify-between border-t border-border bg-surface px-5 py-3 text-[13px] text-muted-foreground sm:px-6">
        <span>{filtered.length} treatment{filtered.length === 1 ? '' : 's'} · page {current} of {pages}</span>
        <div className="flex gap-2"><Button type="button" variant="secondary" className="h-8 px-3 text-xs" disabled={current <= 1} onClick={() => setPage(current - 1)}>Previous</Button><Button type="button" variant="secondary" className="h-8 px-3 text-xs" disabled={current >= pages} onClick={() => setPage(current + 1)}>Next</Button></div>
      </div>
    </div>
  </div>, document.body);
}

function ConsentDrawer({ patient, service, templatesByKey, templatesLoading, records, onClose }: { patient: Patient360; service: ClinicService; templatesByKey: Map<string, ConsentTemplate>; templatesLoading: boolean; records: ConsentRecord[]; onClose: () => void }) {
  const keys = consentKeysForTreatment(service.name);
  const forms = keys.map((key) => templatesByKey.get(key)).filter((template): template is ConsentTemplate => Boolean(template));
  const missing = !templatesLoading && forms.length < keys.length;
  const [activeIndex, setActiveIndex] = useState(0);
  const [signedNow, setSignedNow] = useState<Record<string, ConsentRecord>>({});
  const active = forms[activeIndex];

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
  }, [onClose]);

  // Portalled to <body>: page-transition wrappers apply transforms that would otherwise trap position: fixed.
  return createPortal(<div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={`Consent for ${service.name}`}>
    <button type="button" aria-label="Close consent form" className="absolute inset-0 bg-black/40 backdrop-blur-[1px] animate-fade-in" onClick={onClose} />
    <div className="relative flex h-full w-full max-w-[860px] flex-col bg-background shadow-2xl animate-drawer-in">
      <header className="flex items-start justify-between gap-3 border-b bg-surface px-5 py-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">{service.category || 'Treatment'} · {service.durationMinutes} min</p>
          <h2 className="mt-0.5 truncate text-lg font-semibold">{service.name}</h2>
          {forms.length > 1 ? <p className="mt-0.5 text-xs text-muted-foreground">This treatment combines procedures — {forms.length} consent forms are required.</p> : null}
        </div>
        <Button type="button" variant="ghost" className="size-9 shrink-0 p-0" onClick={onClose} aria-label="Close"><X className="size-5" /></Button>
      </header>

      {forms.length > 1 ? <nav className="flex gap-2 overflow-x-auto border-b bg-surface px-5 py-2.5" aria-label="Required consent forms">{forms.map((template, index) => <button key={template.id} type="button" onClick={() => setActiveIndex(index)} className={cn('inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition', index === activeIndex ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground')}>
        <span className={cn('grid size-5 place-items-center rounded-full text-[11px]', signedNow[template.id] ? 'bg-emerald-600 text-white' : index === activeIndex ? 'bg-primary text-white' : 'bg-muted')}>{signedNow[template.id] ? <Check className="size-3" /> : index + 1}</span>{shortFormName(template)}
      </button>)}</nav> : null}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scroll-padding-bottom:8rem]">
        {templatesLoading ? <div className="m-5 h-96 animate-pulse rounded-xl bg-muted/60" /> : null}
        {missing ? <div className="m-5 flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"><AlertTriangle className="mt-0.5 size-5 shrink-0" /><div><div className="font-semibold">Consent form not published</div><p className="mt-1">The digital consent for this treatment has not been synced to this environment. Ask an administrator to run <code className="rounded bg-amber-100 px-1">npm run consents:sync -w backend</code>.</p></div></div> : null}
        {active ? <ConsentForm
          key={active.id}
          patient={patient}
          service={service}
          template={active}
          previous={records.find((record) => record.template.id === active.id && record.treatmentName === service.name && record.status === 'SIGNED')}
          signedRecord={signedNow[active.id]}
          nextLabel={forms.slice(activeIndex + 1).find((template) => !signedNow[template.id]) ? 'Continue to next form' : undefined}
          onSigned={(record) => setSignedNow((current) => ({ ...current, [active.id]: record }))}
          onNext={() => setActiveIndex(forms.findIndex((template, index) => index > activeIndex && !signedNow[template.id]))}
          onDone={onClose}
        /> : null}
      </div>
    </div>
  </div>, document.body);
}

function ConsentForm({ patient, service, template, previous, signedRecord, nextLabel, onSigned, onNext, onDone }: { patient: Patient360; service: ClinicService; template: ConsentTemplate; previous?: ConsentRecord; signedRecord?: ConsentRecord; nextLabel?: string; onSigned: (record: ConsentRecord) => void; onNext: () => void; onDone: () => void }) {
  const client = useQueryClient();
  const { session } = useSessionStore();
  // A treatment that already has a signed consent opens on that signed form; staff can still start a new one.
  const [signingNew, setSigningNew] = useState(!previous);
  const blocks = useMemo(() => parseConsentText(template.consentText), [template.consentText]);
  const statementCount = blocks.filter((block) => block.kind === 'statement').length;
  const [acknowledged, setAcknowledged] = useState<Set<number>>(new Set());
  const [signerName, setSignerName] = useState(patient.fullName);
  const [patientSignature, setPatientSignature] = useState('');
  const doctorSignature = useDoctorSignature();
  const [doctorId, setDoctorId] = useState('');
  const today = new Date();

  const staffQuery = useQuery({ queryKey: ['consent-doctors', patient.branchId], queryFn: () => apiRequest<{ data: StaffMember[] }>(`/front-desk/staff?branchId=${encodeURIComponent(patient.branchId)}`) });
  const doctors = (staffQuery.data?.data ?? []).filter((member) => doctorRoles.includes(member.role));
  const defaultDoctorId = doctors.find((member) => member.id === session?.user.id)?.id ?? (doctors.length === 1 ? doctors[0].id : '');
  const effectiveDoctorId = doctorId || defaultDoctorId;
  const doctor = doctors.find((member) => member.id === effectiveDoctorId);
  const appointment = patient.appointments
    .filter((item) => item.serviceId === service.id && !['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(item.status))
    .sort((a, b) => +new Date(a.appointmentAt) - +new Date(b.appointmentAt))[0];

  const allAcknowledged = statementCount > 0 && acknowledged.size === statementCount;
  const steps = [
    { label: 'Statements acknowledged', done: allAcknowledged, detail: `${acknowledged.size}/${statementCount}` },
    { label: 'Patient signature', done: Boolean(patientSignature && signerName.trim().length >= 2) },
    { label: 'Doctor signature', done: Boolean(doctor && doctorSignature) },
  ];
  const ready = steps.every((step) => step.done);
  const toggle = (index: number) => setAcknowledged((current) => { const next = new Set(current); if (next.has(index)) next.delete(index); else next.add(index); return next; });

  const sign = useMutation({
    mutationFn: () => {
      if (!doctor) throw new Error('Select the treating doctor');
      return apiRequest<{ data: ConsentRecord }>('/consents/sign', { method: 'POST', body: JSON.stringify({ templateId: template.id, patientId: patient.id, appointmentId: appointment?.id, treatmentName: service.name, signerName: signerName.trim(), signatureBase64: patientSignature, doctorName: doctor.name }) });
    },
    onSuccess: async (result) => {
      onSigned(result.data);
      await Promise.all([client.invalidateQueries({ queryKey: ['patient-consents', patient.id] }), client.invalidateQueries({ queryKey: ['patient-360', patient.id] })]);
    },
  });

  if (signedRecord || (previous && !signingNew)) {
    const record = (signedRecord ?? previous)!;
    return <div className="flex min-h-full flex-col gap-3 p-4 sm:p-6">
      {signedRecord ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        <span className="inline-flex items-center gap-2 font-medium"><CheckCircle2 className="size-5" />Consent signed and saved to {patient.fullName}&apos;s record.</span>
        {nextLabel ? <Button type="button" onClick={onNext}>{nextLabel}<ChevronRight className="size-4" /></Button> : <Button type="button" onClick={onDone}>Done</Button>}
      </div> : <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        <span className="inline-flex items-center gap-2"><CheckCircle2 className="size-5 shrink-0" />Signed on {formatDateTime(record.signedAt)}{record.doctorName ? ` with ${record.doctorName}` : ''} (v{record.templateVersion}).</span>
        <Button type="button" variant="secondary" onClick={() => setSigningNew(true)}><PenLine className="size-4" />Sign new consent</Button>
      </div>}
      <SignedConsentDocument record={record} patient={patient} />
    </div>;
  }

  return <div className="flex min-h-full flex-col">
    <div className="flex-1 space-y-4 p-4 sm:p-6">
      {previous ? <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900"><span>Signing a new consent for this session. The earlier one ({formatDateTime(previous.signedAt)}) stays on record.</span><button type="button" className="font-semibold hover:underline" onClick={() => setSigningNew(false)}>View signed consent</button></div> : null}

      <ConsentShareLink patient={patient} service={service} template={template} appointmentId={appointment?.id} />

      <article className="mx-auto max-w-[720px] rounded-xl border bg-white px-5 py-7 text-[#263743] shadow-sm sm:px-10">
        <header className="text-center">
          <img src="/revive-logo.png" alt="Revive Skin & Hair Clinic, Laser Center" className="mx-auto h-16 w-auto object-contain sm:h-20" />
          <h3 className="mx-auto mt-4 max-w-xl text-base font-bold uppercase leading-snug tracking-wide sm:text-lg">{template.name}</h3>
          <div className="mx-auto mt-3 h-px w-3/5 bg-[#263743]" />
          <p className="mt-2 text-[11px] text-neutral-500">Version {template.currentVersion}</p>
        </header>

        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-[#263743]/70 px-4 py-3.5 text-sm sm:grid-cols-3">
          <PaperField label="Name of Patient" value={`${patient.fullName} (${patient.patientNo})`} className="col-span-2 sm:col-span-3" />
          <PaperField label="Date" value={formatDate(today)} />
          <PaperField label="Age" value={patient.age != null ? `${patient.age} years` : 'Not recorded'} />
          <PaperField label="Sex" value={formatSex(patient.sex)} />
          <PaperField label="Treatment" value={service.name} className="col-span-2 border-t border-neutral-200 pt-3 sm:col-span-3" />
          {appointment ? <div className="col-span-2 -mt-1 flex items-center gap-1.5 text-xs text-primary sm:col-span-3"><CalendarClock className="size-3.5" />Linked to appointment on {formatDateTime(appointment.appointmentAt)}</div> : null}
        </dl>

        <div className="mt-5 flex items-center justify-between gap-3 rounded-lg bg-neutral-50 px-3 py-2 text-xs">
          <span className="text-neutral-600">Read each statement to the patient and tick it once understood.</span>
          <button type="button" className="shrink-0 font-semibold text-primary hover:underline" onClick={() => setAcknowledged(allAcknowledged ? new Set() : new Set(Array.from({ length: statementCount }, (_, index) => index)))}>{allAcknowledged ? 'Clear all' : 'Tick all'}</button>
        </div>

        <div className="mt-3 space-y-1">{blocks.map((block, index) => {
          if (block.kind === 'heading') return <h4 key={index} className="pt-3 text-xs font-bold uppercase tracking-wider text-primary">{block.text}</h4>;
          if (block.kind === 'paragraph') return <p key={index} className="px-1 pt-1 text-[15px] leading-relaxed text-neutral-700">{block.text}</p>;
          const checked = acknowledged.has(block.statementIndex!);
          return <label key={index} className={cn('flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 text-[15px] leading-relaxed transition', checked ? 'bg-primary/[0.05]' : 'hover:bg-neutral-50')}>
            <input type="checkbox" className="peer sr-only" checked={checked} onChange={() => toggle(block.statementIndex!)} />
            <span aria-hidden className={cn('mt-1 grid size-[18px] shrink-0 place-items-center rounded border-2 transition peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40', checked ? 'border-primary bg-primary text-white' : 'border-neutral-400 bg-white')}>{checked ? <Check className="size-3" strokeWidth={3} /> : null}</span>
            <span>{block.text}</span>
          </label>;
        })}</div>

        <div className="mt-8 grid gap-6 border-t border-dashed border-neutral-300 pt-6 md:grid-cols-2">
          <section aria-label="Signature of Patient">
            <div className="flex items-baseline justify-between"><h4 className="font-semibold">Signature of Patient</h4><span className="text-xs text-neutral-500">Date: {formatDate(today)}</span></div>
            <Input className="mt-2 bg-white" value={signerName} onChange={(event) => setSignerName(event.target.value)} placeholder="Patient / signer name" aria-label="Signer name" />
            <div className="mt-2"><SignaturePad disabled={!allAcknowledged} disabledLabel="Locked" onChange={setPatientSignature} /></div>
            {!allAcknowledged ? <p className="text-xs text-amber-700">Unlocks after all {statementCount} statements are ticked.</p> : null}
          </section>
          <section aria-label="Signature of Doctor">
            <div className="flex items-baseline justify-between"><h4 className="font-semibold">Signature of Doctor</h4><span className="text-xs text-neutral-500">Date: {formatDate(today)}</span></div>
            <Select className="mt-2 bg-white" value={effectiveDoctorId} onChange={(event) => { if (event.target.value === effectiveDoctorId) return; setDoctorId(event.target.value); }} aria-label="Treating doctor"><option value="">{staffQuery.isLoading ? 'Loading doctors…' : 'Select treating doctor'}</option>{doctors.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</Select>
            <div className="mt-2"><DoctorSignatureBox signature={doctorSignature} /></div>
            {!patientSignature ? <p className="text-xs text-neutral-500">The doctor’s signature on file is applied automatically after the patient signs.</p> : null}
          </section>
        </div>
      </article>
    </div>

    <footer className="sticky bottom-0 border-t bg-surface/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ol className="flex flex-wrap gap-x-4 gap-y-1 text-xs">{steps.map((step) => <li key={step.label} className={cn('inline-flex items-center gap-1.5', step.done ? 'text-emerald-700' : 'text-muted-foreground')}>
          <span className={cn('grid size-4 place-items-center rounded-full border', step.done ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-border')}>{step.done ? <Check className="size-2.5" strokeWidth={3} /> : null}</span>{step.label}{step.detail && !step.done ? ` ${step.detail}` : ''}
        </li>)}</ol>
        <Button type="button" className="w-full sm:w-auto" disabled={!ready || sign.isPending} onClick={() => sign.mutate()}><FileSignature className="size-4" />{sign.isPending ? 'Saving signed consent…' : 'Sign & save consent'}</Button>
      </div>
      {sign.isError ? <p role="alert" className="mt-2 text-sm text-red-700">{sign.error.message}</p> : null}
    </footer>
  </div>;
}

function ConsentShareLink({ patient, service, template, appointmentId }: { patient: Patient360; service: ClinicService; template: ConsentTemplate; appointmentId?: string }) {
  const [copied, setCopied] = useState(false);
  const [share, setShare] = useState<{ invitationId: string; url: string; expiresAt: string } | null>(null);
  const invitation = useMutation({ mutationFn: () => apiRequest<{ data: { invitationId: string; url: string; expiresAt: string } }>('/consents/invitations', { method: 'POST', body: JSON.stringify({ templateId: template.id, patientId: patient.id, appointmentId, treatmentName: service.name }) }), onSuccess: (result) => setShare(result.data) });
  const revoke = useMutation({ mutationFn: () => {
    if (!share) throw new Error('Generate a consent link first');
    return apiRequest(`/consents/invitations/${encodeURIComponent(share.invitationId)}/revoke`, { method: 'POST', body: JSON.stringify({}) });
  }, onSuccess: () => setShare(null) });
  const digits = patient.mobile.replace(/\D/g, '').replace(/^0+/, '');
  const whatsappNumber = digits.length === 10 ? `91${digits}` : digits;
  const message = share ? `Hello ${patient.fullName}, Revive Clinic has shared the consent form for ${service.name}. Please review and sign it securely here: ${share.url}` : '';
  const copy = async () => { if (!share) return; await navigator.clipboard.writeText(share.url); setCopied(true); window.setTimeout(() => setCopied(false), 2_000); };

  return <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-600 text-white"><MessageCircle className="size-5" /></span><div><h3 className="font-semibold text-emerald-950">Send consent to patient on WhatsApp</h3><p className="mt-0.5 text-xs text-emerald-800">Creates a secure, single-use link for {patient.mobile}. The link expires after 7 days.</p></div></div>
      {!share ? <Button type="button" disabled={invitation.isPending} onClick={() => invitation.mutate()}><Link2 className="size-4" />{invitation.isPending ? 'Generating…' : 'Generate consent link'}</Button> : <div className="flex gap-2"><Button type="button" variant="secondary" disabled={invitation.isPending || revoke.isPending} onClick={() => invitation.mutate()}><RotateCw className="size-4" />{invitation.isPending ? 'Reissuing…' : 'Reissue'}</Button><Button type="button" variant="secondary" disabled={revoke.isPending || invitation.isPending} onClick={() => revoke.mutate()}><Unlink className="size-4" />{revoke.isPending ? 'Revoking…' : 'Revoke'}</Button></div>}
    </div>
    {share ? <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
      <Input readOnly value={share.url} aria-label="Patient consent link" className="bg-white text-xs" />
      <Button type="button" variant="secondary" onClick={copy}><Clipboard className="size-4" />{copied ? 'Copied' : 'Copy'}</Button>
      <a className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#25D366] px-4 text-sm font-medium text-white transition hover:bg-[#1fbd59]" href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer"><MessageCircle className="size-4" />Send via WhatsApp</a>
    </div> : null}
    {invitation.isError || revoke.isError ? <p role="alert" className="mt-2 text-sm text-red-700">{invitation.error?.message ?? revoke.error?.message}</p> : null}
  </div>;
}

function DoctorCountersignDialog({ patient, record, onClose, onCompleted }: { patient: Patient360; record: ConsentRecord; onClose: () => void; onCompleted: () => void }) {
  const { session } = useSessionStore();
  const [doctorId, setDoctorId] = useState('');
  const signature = useDoctorSignature();
  const staffQuery = useQuery({ queryKey: ['consent-doctors', patient.branchId], queryFn: () => apiRequest<{ data: StaffMember[] }>(`/front-desk/staff?branchId=${encodeURIComponent(patient.branchId)}`) });
  const doctors = (staffQuery.data?.data ?? []).filter((member) => doctorRoles.includes(member.role));
  const effectiveDoctorId = doctorId || doctors.find((member) => member.id === session?.user.id)?.id || (doctors.length === 1 ? doctors[0].id : '');
  const doctor = doctors.find((member) => member.id === effectiveDoctorId);
  const complete = useMutation({ mutationFn: () => {
    if (!doctor) throw new Error('Select the treating doctor');
    return apiRequest(`/consents/${record.id}/complete`, { method: 'POST', body: JSON.stringify({ doctorName: doctor.name }) });
  }, onSuccess: onCompleted });

  return createPortal(<div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-black/45 p-4" role="dialog" aria-modal="true" aria-label="Doctor countersign consent">
    <Card className="w-full max-w-lg">
      <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Patient signed via WhatsApp link</p><h2 className="mt-1 text-lg font-semibold">Doctor countersign</h2><p className="mt-1 text-sm text-muted-foreground">{record.treatmentName ?? record.template.name} · patient signature received {formatDateTime(record.signedAt)}</p></div><Button type="button" variant="ghost" className="size-9 p-0" onClick={onClose}><X className="size-5" /></Button></div>
      <label className="mt-5 grid gap-1.5 text-sm"><span className="font-medium">Treating doctor</span><Select value={effectiveDoctorId} onChange={(event) => { setDoctorId(event.target.value); }}><option value="">{staffQuery.isLoading ? 'Loading doctors…' : 'Select doctor'}</option>{doctors.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</Select></label>
      <div className="mt-4"><div className="mb-1.5 text-sm font-medium">Doctor signature</div><DoctorSignatureBox signature={signature} /></div>
      {complete.isError ? <p className="mt-2 text-sm text-red-700">{complete.error.message}</p> : null}
      <div className="mt-5 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="button" disabled={!doctor || !signature || complete.isPending} onClick={() => complete.mutate()}><PenLine className="size-4" />{complete.isPending ? 'Saving…' : 'Countersign & complete'}</Button></div>
    </Card>
  </div>, document.body);
}

function PaperField({ label, value, className }: { label: string; value: string; className?: string }) {
  return <div className={className}><dt className="text-[11px] text-neutral-500">{label}</dt><dd className="font-semibold">{value}</dd></div>;
}
