'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, Download, Eye, FileSignature, Printer, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { parseConsentText } from '@/lib/treatment-consents';
import { cn } from '@/lib/utils';
import { apiBlob, apiRequest } from '@/services/api';
import type { Patient360 } from '@/types/clinical';
import type { ConsentRecord } from '@/types/forms';

export const formatConsentDate = (value?: string | null) => value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '-';

// Shared by the Treatment tab, Overview and Care History so all three read the same cached records.
export function usePatientConsents(patientId: string) {
  return useQuery({ queryKey: ['patient-consents', patientId], queryFn: () => apiRequest<{ data: ConsentRecord[] }>(`/consents/patients/${patientId}`) });
}

export const isTreatmentConsent = (record: ConsentRecord) => record.template.type === 'PROCEDURE_SPECIFIC_CONSENT' || Boolean(record.treatmentName);

export function ConsentStatusChip({ status }: { status: ConsentRecord['status'] }) {
  const tone = status === 'SIGNED' ? 'bg-emerald-50 text-emerald-700' : status === 'WITHDRAWN' ? 'bg-red-50 text-red-700' : 'bg-muted text-muted-foreground';
  return <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', tone)}>{status.charAt(0) + status.slice(1).toLowerCase()}</span>;
}

type ConsentPatient = Pick<Patient360, 'fullName' | 'patientNo' | 'age' | 'sex'>;
const formatDay = (value: string) => new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

function useSignatureImage(recordId: string, signer: 'patient' | 'doctor', enabled: boolean) {
  const query = useQuery({ queryKey: ['consent-signature', recordId, signer], queryFn: () => apiBlob(`/consents/${recordId}/signatures/${signer}`), enabled, staleTime: Infinity, retry: false });
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!query.data) return;
    const objectUrl = URL.createObjectURL(query.data); setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [query.data]);
  return { url, failed: query.isError };
}

// Renders the signed record (its stored text snapshot and signatures) in the paper layout. Plain HTML shows on every
// device, unlike an embedded PDF; the immutable PDF stays available for printing and download.
export function SignedConsentDocument({ record, patient, className }: { record: ConsentRecord; patient: ConsentPatient; className?: string }) {
  const patientSignature = useSignatureImage(record.id, 'patient', true);
  const doctorSignature = useSignatureImage(record.id, 'doctor', Boolean(record.doctorName));
  const pdf = useMutation({ mutationFn: () => apiBlob(`/consents/${record.id}/pdf`) });
  const fileName = `${(record.treatmentName ?? record.template.name).replace(/[^\w-]+/g, '-')}-consent.pdf`;
  const download = () => pdf.mutate(undefined, { onSuccess: (blob) => { const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = fileName; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1_000); } });
  const print = () => pdf.mutate(undefined, { onSuccess: (blob) => { const url = URL.createObjectURL(blob); const frame = document.createElement('iframe'); frame.style.display = 'none'; frame.src = url; frame.onload = () => { frame.contentWindow?.focus(); frame.contentWindow?.print(); window.setTimeout(() => { frame.remove(); URL.revokeObjectURL(url); }, 60_000); }; document.body.appendChild(frame); } });
  const blocks = parseConsentText(record.consentText);
  const signedDay = formatDay(record.signedAt);

  return <div className={cn('flex flex-col', className)}>
    <div className="flex flex-wrap items-center justify-end gap-2 pb-3">
      <Button type="button" variant="secondary" className="h-8 px-3 text-xs" disabled={pdf.isPending} onClick={print}><Printer className="size-3.5" />Print</Button>
      <Button type="button" variant="secondary" className="h-8 px-3 text-xs" disabled={pdf.isPending} onClick={download}><Download className="size-3.5" />{pdf.isPending ? 'Preparing…' : 'Download PDF'}</Button>
    </div>
    {pdf.isError ? <p role="alert" className="pb-2 text-right text-xs text-red-700">{pdf.error.message}</p> : null}
    <article className="mx-auto w-full max-w-[720px] rounded-xl border bg-white px-5 py-7 text-[#241417] shadow-sm sm:px-10">
      <header className="text-center">
        <img src="/revive-logo.png" alt="Revive Skin & Hair Clinic, Laser Center" className="mx-auto h-16 w-auto object-contain sm:h-20" />
        <h3 className="mx-auto mt-4 max-w-xl text-base font-bold uppercase leading-snug tracking-wide sm:text-lg">{record.template.name}</h3>
        <div className="mx-auto mt-3 h-px w-3/5 bg-[#241417]" />
        <p className="mt-2 text-[11px] text-neutral-500">Version {record.templateVersion}</p>
      </header>
      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-[#241417]/70 px-4 py-3.5 text-sm sm:grid-cols-3">
        <PaperField label="Name of Patient" value={`${patient.fullName} (${patient.patientNo})`} className="col-span-2 sm:col-span-3" />
        <PaperField label="Date" value={signedDay} />
        <PaperField label="Age" value={patient.age != null ? `${patient.age} years` : 'Not recorded'} />
        <PaperField label="Sex" value={patient.sex ? patient.sex.charAt(0) + patient.sex.slice(1).toLowerCase() : 'Not recorded'} />
        {record.treatmentName ? <PaperField label="Treatment" value={record.treatmentName} className="col-span-2 border-t border-neutral-200 pt-3 sm:col-span-3" /> : null}
      </dl>
      <div className="mt-5 space-y-1">{blocks.map((block, index) => {
        if (block.kind === 'heading') return <h4 key={index} className="pt-3 text-xs font-bold uppercase tracking-wider text-primary">{block.text}</h4>;
        if (block.kind === 'paragraph') return <p key={index} className="px-1 pt-1 text-[15px] leading-relaxed text-neutral-700">{block.text}</p>;
        return <div key={index} className="flex items-start gap-3 px-2 py-1.5 text-[15px] leading-relaxed"><span aria-label="Acknowledged" className="mt-1 grid size-[18px] shrink-0 place-items-center rounded border-2 border-primary bg-primary text-white"><Check className="size-3" strokeWidth={3} /></span><span>{block.text}</span></div>;
      })}</div>
      <p className="mt-4 text-xs italic text-neutral-500">Each statement above was read, understood and individually acknowledged by the patient before signing.</p>
      <div className="mt-6 grid gap-6 border-t border-dashed border-neutral-300 pt-6 sm:grid-cols-2">
        <SignatureBlock title="Signature of Patient" name={record.signerName} signature={patientSignature} date={signedDay} />
        {record.doctorName ? <SignatureBlock title="Signature of Doctor" name={record.doctorName} signature={doctorSignature} date={signedDay} alignRight /> : null}
      </div>
      {record.status === 'WITHDRAWN' ? <p className="mt-5 rounded-md bg-red-50 p-3 text-sm text-red-700">Withdrawn{record.withdrawnAt ? ` on ${formatConsentDate(record.withdrawnAt)}` : ''}{record.withdrawalReason ? `: ${record.withdrawalReason}` : ''}</p> : null}
      <p className="mt-6 text-center text-[11px] text-neutral-500">Digitally signed {formatConsentDate(record.signedAt)} · Immutable consent record</p>
    </article>
  </div>;
}

function PaperField({ label, value, className }: { label: string; value: string; className?: string }) {
  return <div className={className}><dt className="text-[11px] text-neutral-500">{label}</dt><dd className="font-semibold">{value}</dd></div>;
}

function SignatureBlock({ title, name, signature, date, alignRight = false }: { title: string; name: string; signature: { url: string; failed: boolean }; date: string; alignRight?: boolean }) {
  return <div className={cn(alignRight && 'sm:text-right')}>
    <div className={cn('flex h-20 items-end', alignRight && 'sm:justify-end')}>
      {signature.url ? <img src={signature.url} alt={`${title}: ${name}`} className="max-h-20 max-w-[220px] object-contain" /> : <span className="text-xs text-neutral-400">{signature.failed ? 'Signature stored in the signed PDF' : 'Loading signature…'}</span>}
    </div>
    <div className="mt-1 border-t border-dotted border-neutral-400 pt-1.5 font-semibold">{title}</div>
    <div className="text-sm">{name}</div>
    <div className="text-xs text-neutral-500">Date: {date}</div>
  </div>;
}

export function SignedConsentViewer({ record, patient, onClose }: { record: ConsentRecord; patient: ConsentPatient; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
  }, [onClose]);

  // Portalled to <body>: page-transition wrappers apply transforms that would otherwise trap position: fixed.
  return createPortal(<div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Signed consent">
    <button type="button" aria-label="Close signed consent" className="absolute inset-0 bg-black/40 animate-fade-in" onClick={onClose} />
    <div className="relative flex h-full w-full max-w-[860px] flex-col bg-background shadow-2xl animate-drawer-in">
      <header className="flex items-start justify-between gap-3 border-b bg-surface px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2"><p className="text-xs font-semibold uppercase tracking-wider text-primary">Signed consent</p><ConsentStatusChip status={record.status} /></div>
          <h2 className="mt-0.5 truncate text-lg font-semibold">{record.treatmentName ?? record.template.name}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{record.template.name} · v{record.templateVersion} · {formatConsentDate(record.signedAt)}{record.doctorName ? ` · ${record.doctorName}` : ''}</p>
        </div>
        <Button type="button" variant="ghost" className="size-9 shrink-0 p-0" onClick={onClose} aria-label="Close"><X className="size-5" /></Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5"><SignedConsentDocument record={record} patient={patient} /></div>
    </div>
  </div>, document.body);
}

// "Treatments chosen" list used on Overview and Care History: what the patient is going for, with the consent beside it.
export function TreatmentConsentsCard({ patient, title = 'Treatments chosen', description, onOpenTreatmentTab }: { patient: Patient360; title?: string; description?: string; onOpenTreatmentTab?: () => void }) {
  const consentsQuery = usePatientConsents(patient.id);
  const [viewing, setViewing] = useState<ConsentRecord | null>(null);
  const records = (consentsQuery.data?.data ?? []).filter(isTreatmentConsent);

  return <Card>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-2"><FileSignature className="mt-0.5 size-5 text-primary" /><div><h3 className="font-semibold">{title}</h3>{description ? <p className="text-xs text-muted-foreground">{description}</p> : null}</div></div>
      {onOpenTreatmentTab ? <Button type="button" variant="secondary" className="h-8 px-3 text-xs" onClick={onOpenTreatmentTab}>Choose treatment</Button> : null}
    </div>
    <div className="mt-3 divide-y rounded-lg border">
      {consentsQuery.isLoading ? <div className="h-16 animate-pulse bg-muted/50" /> : null}
      {consentsQuery.isError ? <p className="p-3 text-sm text-red-700">{consentsQuery.error.message}</p> : null}
      {records.map((record) => <div key={record.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{record.treatmentName ?? record.template.name}</span><ConsentStatusChip status={record.status} /></div>
          <div className="mt-1 text-xs text-muted-foreground">Consent: {record.template.name} · {formatConsentDate(record.signedAt)}{record.doctorName ? ` · ${record.doctorName}` : ''}</div>
        </div>
        <Button type="button" variant="secondary" className="h-8 px-3 text-xs" onClick={() => setViewing(record)}><Eye className="size-3.5" />View consent</Button>
      </div>)}
      {!consentsQuery.isLoading && !consentsQuery.isError && !records.length ? <p className="py-8 text-center text-sm text-muted-foreground">No treatment selected yet. Choose one from the Treatment tab to record it here with its signed consent.</p> : null}
    </div>
    {viewing ? <SignedConsentViewer record={viewing} patient={patient} onClose={() => setViewing(null)} /> : null}
  </Card>;
}
