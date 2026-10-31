'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CalendarClock, Check, CheckCircle2, ChevronRight, Clock3, FileSignature, FileText, Search, ShieldCheck, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { SignaturePad } from '@/components/ui/signature-pad';
import { cn } from '@/lib/utils';
import { consentKeysForTreatment, generalConsentKey, parseConsentText } from '@/lib/treatment-consents';
import { apiBlob, apiRequest } from '@/services/api';
import { useSessionStore } from '@/store/session-store';
import type { ClinicService } from '@/types/appointment';
import type { Patient360 } from '@/types/clinical';
import type { ConsentRecord, ConsentTemplate } from '@/types/forms';
import type { StaffMember } from '@/types/front-desk';

const formatDateTime = (value?: string | null) => value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '-';
const formatDate = (value: Date | string) => new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
const formatSex = (value?: string | null) => value ? value.charAt(0) + value.slice(1).toLowerCase() : 'Not recorded';
const shortFormName = (template: ConsentTemplate) => template.key === generalConsentKey ? 'General consent' : template.name.replace(/^Informed consent (for|of) /i, '').replace(/ Consent Form$/i, '');
const doctorRoles = ['ADMIN', 'DOCTOR'];

function useOpenPdf() {
  return useMutation({ mutationFn: (id: string) => apiBlob(`/consents/${id}/pdf`), onSuccess: (blob) => { const url = URL.createObjectURL(blob); window.open(url, '_blank', 'noopener,noreferrer'); window.setTimeout(() => URL.revokeObjectURL(url), 60_000); } });
}

export function PatientTreatmentPanel({ patient }: { patient: Patient360 }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [selectedServiceId, setSelectedServiceId] = useState('');

  const servicesQuery = useQuery({ queryKey: ['patient-treatment-services', patient.branchId], queryFn: () => apiRequest<{ data: ClinicService[] }>(`/front-desk/services?branchId=${encodeURIComponent(patient.branchId)}`) });
  const templatesQuery = useQuery({ queryKey: ['patient-consent-templates', patient.branchId], queryFn: () => apiRequest<{ data: ConsentTemplate[] }>(`/consents/templates?branchId=${encodeURIComponent(patient.branchId)}`) });
  const recordsQuery = useQuery({ queryKey: ['patient-consents', patient.id], queryFn: () => apiRequest<{ data: ConsentRecord[] }>(`/consents/patients/${patient.id}`) });
  const pdf = useOpenPdf();

  // Same source and filter as Schedules & Rooms > Create Appointment > Treatment service.
  const treatments = useMemo(() => (servicesQuery.data?.data ?? [])
    .filter((service) => service.active && service.resourceType === 'TREATMENT_ROOM')
    .sort((a, b) => (a.category ?? '').localeCompare(b.category ?? '') || a.name.localeCompare(b.name)), [servicesQuery.data?.data]);
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const service of treatments) counts.set(service.category || 'Other treatments', (counts.get(service.category || 'Other treatments') ?? 0) + 1);
    return [...counts.entries()];
  }, [treatments]);
  const visible = treatments.filter((service) => (category === 'All' || (service.category || 'Other treatments') === category) && `${service.name} ${service.category ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()));
  const groups = useMemo(() => {
    const map = new Map<string, ClinicService[]>();
    for (const service of visible) map.set(service.category || 'Other treatments', [...(map.get(service.category || 'Other treatments') ?? []), service]);
    return [...map.entries()];
  }, [visible]);

  const templatesByKey = useMemo(() => new Map((templatesQuery.data?.data ?? []).filter((template) => template.status === 'PUBLISHED').map((template) => [template.key, template])), [templatesQuery.data?.data]);
  const records = recordsQuery.data?.data ?? [];
  const procedureRecords = records.filter((record) => record.template.type === 'PROCEDURE_SPECIFIC_CONSENT' || record.treatmentName);
  const lastSignedFor = (name: string) => procedureRecords.find((record) => record.treatmentName === name && record.status === 'SIGNED');
  const selectedService = treatments.find((service) => service.id === selectedServiceId);

  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Treatment & informed consent</p>
        <h2 className="mt-1 text-xl font-semibold">Select a treatment to open its consent form</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">All treatment services from Schedules & Rooms are listed here. Choosing one opens the clinic&apos;s matching consent form for {patient.fullName} to acknowledge and sign with the treating doctor.</p>
      </div>
      <div className="flex gap-2 text-xs">
        <span className="rounded-full border bg-surface px-3 py-1.5"><b className="font-semibold">{treatments.length}</b> treatments</span>
        <span className="rounded-full border bg-surface px-3 py-1.5"><b className="font-semibold">{procedureRecords.filter((record) => record.status === 'SIGNED').length}</b> consents on file</span>
      </div>
    </div>

    <Card className="p-0">
      <div className="space-y-3 border-b p-4">
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search treatments, e.g. HIFU, peel, laser hair" aria-label="Search treatments" /></div>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {[['All', treatments.length] as const, ...categories].map(([name, count]) => <button key={name} type="button" onClick={() => setCategory(name)} className={cn('shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition', category === name ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-surface text-muted-foreground hover:border-primary/40 hover:text-foreground')}>{name} <span className="opacity-70">{count}</span></button>)}
        </div>
      </div>

      {servicesQuery.isLoading ? <div className="space-y-2 p-4">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-14 animate-pulse rounded-lg bg-muted/60" />)}</div> : null}
      {servicesQuery.isError ? <p className="p-4 text-sm text-red-700">{servicesQuery.error.message}</p> : null}
      {templatesQuery.isError ? <p className="border-b bg-amber-50 p-4 text-sm text-amber-900">Consent forms could not be loaded: {templatesQuery.error.message}</p> : null}
      {!servicesQuery.isLoading && !servicesQuery.isError && !visible.length ? <p className="py-12 text-center text-sm text-muted-foreground">No treatments match “{search}”.</p> : null}

      <div className="divide-y">{groups.map(([group, services]) => <section key={group}>
        <h3 className="sticky top-0 z-[1] bg-muted/70 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur">{group}<span className="ml-2 font-normal normal-case tracking-normal">{services.length}</span></h3>
        <ul className="divide-y divide-border/70">{services.map((service) => {
          const forms = consentKeysForTreatment(service.name).map((key) => templatesByKey.get(key)).filter((template): template is ConsentTemplate => Boolean(template));
          const signed = lastSignedFor(service.name);
          return <li key={service.id}>
            <button type="button" onClick={() => setSelectedServiceId(service.id)} className="group flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-primary/[0.04] focus-visible:bg-primary/[0.06]">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><FileSignature className="size-4" /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{service.name}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Clock3 className="size-3" />{service.durationMinutes} min</span>
                  {service.basePrice != null ? <span>₹{Number(service.basePrice).toLocaleString('en-IN')}</span> : null}
                  {forms.map((template) => <span key={template.id} className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-foreground/80">{shortFormName(template)}</span>)}
                </span>
              </span>
              {signed ? <span className="hidden shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 sm:inline-flex"><CheckCircle2 className="size-3" />Signed {formatDate(signed.signedAt)}</span> : null}
              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
            </button>
          </li>;
        })}</ul>
      </section>)}</div>
    </Card>

    <Card>
      <div className="flex items-center gap-2"><ShieldCheck className="size-5 text-primary" /><h3 className="font-semibold">Treatment consent history</h3></div>
      <div className="mt-3 divide-y rounded-lg border">{procedureRecords.map((record) => <div key={record.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{record.treatmentName ?? record.template.name}</span><StatusChip status={record.status} /></div>
          <div className="mt-1 text-xs text-muted-foreground">{record.template.name} · v{record.templateVersion} · {formatDateTime(record.signedAt)}{record.doctorName ? ` · ${record.doctorName}` : ''}</div>
        </div>
        <Button type="button" variant="secondary" className="h-8 px-3 text-xs" disabled={pdf.isPending} onClick={() => pdf.mutate(record.id)}><FileText className="size-3.5" />Signed PDF</Button>
      </div>)}{!procedureRecords.length ? <p className="py-8 text-center text-sm text-muted-foreground">No treatment consents have been signed yet.</p> : null}</div>
      {pdf.isError ? <p role="alert" className="mt-2 text-sm text-red-700">{pdf.error.message}</p> : null}
    </Card>

    {selectedService ? <ConsentDrawer key={selectedService.id} patient={patient} service={selectedService} templatesByKey={templatesByKey} templatesLoading={templatesQuery.isLoading} records={procedureRecords} onClose={() => setSelectedServiceId('')} /> : null}
  </div>;
}

function StatusChip({ status }: { status: ConsentRecord['status'] }) {
  const tone = status === 'SIGNED' ? 'bg-emerald-50 text-emerald-700' : status === 'WITHDRAWN' ? 'bg-red-50 text-red-700' : 'bg-muted text-muted-foreground';
  return <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', tone)}>{status.charAt(0) + status.slice(1).toLowerCase()}</span>;
}

function ConsentDrawer({ patient, service, templatesByKey, templatesLoading, records, onClose }: { patient: Patient360; service: ClinicService; templatesByKey: Map<string, ConsentTemplate>; templatesLoading: boolean; records: ConsentRecord[]; onClose: () => void }) {
  const keys = consentKeysForTreatment(service.name);
  const forms = keys.map((key) => templatesByKey.get(key)).filter((template): template is ConsentTemplate => Boolean(template));
  const missing = !templatesLoading && forms.length < keys.length;
  const [activeIndex, setActiveIndex] = useState(0);
  const [signedNow, setSignedNow] = useState<Record<string, string>>({});
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

      <div className="min-h-0 flex-1 overflow-y-auto">
        {templatesLoading ? <div className="m-5 h-96 animate-pulse rounded-xl bg-muted/60" /> : null}
        {missing ? <div className="m-5 flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"><AlertTriangle className="mt-0.5 size-5 shrink-0" /><div><div className="font-semibold">Consent form not published</div><p className="mt-1">The digital consent for this treatment has not been synced to this environment. Ask an administrator to run <code className="rounded bg-amber-100 px-1">npm run consents:sync -w backend</code>.</p></div></div> : null}
        {active ? <ConsentForm
          key={active.id}
          patient={patient}
          service={service}
          template={active}
          previous={records.find((record) => record.template.id === active.id && record.treatmentName === service.name && record.status === 'SIGNED')}
          signedRecordId={signedNow[active.id]}
          nextLabel={forms.slice(activeIndex + 1).find((template) => !signedNow[template.id]) ? 'Continue to next form' : undefined}
          onSigned={(recordId) => setSignedNow((current) => ({ ...current, [active.id]: recordId }))}
          onNext={() => setActiveIndex(forms.findIndex((template, index) => index > activeIndex && !signedNow[template.id]))}
          onDone={onClose}
        /> : null}
      </div>
    </div>
  </div>, document.body);
}

function ConsentForm({ patient, service, template, previous, signedRecordId, nextLabel, onSigned, onNext, onDone }: { patient: Patient360; service: ClinicService; template: ConsentTemplate; previous?: ConsentRecord; signedRecordId?: string; nextLabel?: string; onSigned: (recordId: string) => void; onNext: () => void; onDone: () => void }) {
  const client = useQueryClient();
  const { session } = useSessionStore();
  const pdf = useOpenPdf();
  const blocks = useMemo(() => parseConsentText(template.consentText), [template.consentText]);
  const statementCount = blocks.filter((block) => block.kind === 'statement').length;
  const [acknowledged, setAcknowledged] = useState<Set<number>>(new Set());
  const [signerName, setSignerName] = useState(patient.fullName);
  const [patientSignature, setPatientSignature] = useState('');
  const [doctorSignature, setDoctorSignature] = useState('');
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
      return apiRequest<{ data: ConsentRecord }>('/consents/sign', { method: 'POST', body: JSON.stringify({ templateId: template.id, patientId: patient.id, appointmentId: appointment?.id, treatmentName: service.name, signerName: signerName.trim(), signatureBase64: patientSignature, doctorName: doctor.name, doctorSignatureBase64: doctorSignature }) });
    },
    onSuccess: async (result) => {
      onSigned(result.data.id);
      await Promise.all([client.invalidateQueries({ queryKey: ['patient-consents', patient.id] }), client.invalidateQueries({ queryKey: ['patient-360', patient.id] })]);
    },
  });

  if (signedRecordId) return <div className="grid min-h-full place-items-center p-8">
    <div className="max-w-md text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 className="size-8" /></span>
      <h3 className="mt-4 text-lg font-semibold">Consent signed and saved</h3>
      <p className="mt-1 text-sm text-muted-foreground">{template.name} for {service.name} has been stored as a signed PDF in {patient.fullName}&apos;s record.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button type="button" variant="secondary" disabled={pdf.isPending} onClick={() => pdf.mutate(signedRecordId)}><FileText className="size-4" />{pdf.isPending ? 'Opening…' : 'Open signed PDF'}</Button>
        {nextLabel ? <Button type="button" onClick={onNext}>{nextLabel}<ChevronRight className="size-4" /></Button> : <Button type="button" onClick={onDone}>Done</Button>}
      </div>
      {pdf.isError ? <p role="alert" className="mt-3 text-sm text-red-700">{pdf.error.message}</p> : null}
    </div>
  </div>;

  return <div className="flex min-h-full flex-col">
    <div className="flex-1 space-y-4 p-4 sm:p-6">
      {previous ? <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-900"><CheckCircle2 className="mt-0.5 size-4 shrink-0" /><span>This consent was last signed on {formatDateTime(previous.signedAt)} (v{previous.templateVersion}). Signing again creates a new record for this session.</span></div> : null}

      <article className="mx-auto max-w-[720px] rounded-xl border bg-white px-5 py-7 text-[#241417] shadow-sm sm:px-10">
        <header className="text-center">
          <img src="/revive-logo.png" alt="Revive Skin & Hair Clinic, Laser Center" className="mx-auto h-16 w-auto object-contain sm:h-20" />
          <h3 className="mx-auto mt-4 max-w-xl text-base font-bold uppercase leading-snug tracking-wide sm:text-lg">{template.name}</h3>
          <div className="mx-auto mt-3 h-px w-3/5 bg-[#241417]" />
          <p className="mt-2 text-[11px] text-neutral-500">Version {template.currentVersion}</p>
        </header>

        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-[#241417]/70 px-4 py-3.5 text-sm sm:grid-cols-3">
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
            <Select className="mt-2 bg-white" value={effectiveDoctorId} onChange={(event) => { setDoctorId(event.target.value); setDoctorSignature(''); }} aria-label="Treating doctor"><option value="">{staffQuery.isLoading ? 'Loading doctors…' : 'Select treating doctor'}</option>{doctors.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</Select>
            <div className="mt-2"><SignaturePad key={effectiveDoctorId} disabled={!doctor || !patientSignature} disabledLabel="Locked" onChange={setDoctorSignature} /></div>
            {!patientSignature ? <p className="text-xs text-neutral-500">The doctor signs after the patient.</p> : null}
          </section>
        </div>
      </article>
    </div>

    <footer className="sticky bottom-0 border-t bg-surface/95 px-4 py-3 backdrop-blur sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ol className="flex flex-wrap gap-x-4 gap-y-1 text-xs">{steps.map((step) => <li key={step.label} className={cn('inline-flex items-center gap-1.5', step.done ? 'text-emerald-700' : 'text-muted-foreground')}>
          <span className={cn('grid size-4 place-items-center rounded-full border', step.done ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-border')}>{step.done ? <Check className="size-2.5" strokeWidth={3} /> : null}</span>{step.label}{step.detail && !step.done ? ` ${step.detail}` : ''}
        </li>)}</ol>
        <Button type="button" disabled={!ready || sign.isPending} onClick={() => sign.mutate()}><FileSignature className="size-4" />{sign.isPending ? 'Saving signed consent…' : 'Sign & save consent'}</Button>
      </div>
      {sign.isError ? <p role="alert" className="mt-2 text-sm text-red-700">{sign.error.message}</p> : null}
    </footer>
  </div>;
}

function PaperField({ label, value, className }: { label: string; value: string; className?: string }) {
  return <div className={className}><dt className="text-[11px] text-neutral-500">{label}</dt><dd className="font-semibold">{value}</dd></div>;
}
