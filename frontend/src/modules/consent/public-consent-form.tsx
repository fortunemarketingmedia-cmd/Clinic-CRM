'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, CheckCircle2, FileSignature, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SignaturePad } from '@/components/ui/signature-pad';
import { parseConsentText } from '@/lib/treatment-consents';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/services/api';

type PublicConsent = { completed: true } | { completed: false; patient: { fullName: string; patientNo: string; age?: number | null; sex?: string | null }; treatmentName: string; template: { name: string; version: number; consentText: string }; expiresAt: string };

const formatDate = (value: Date | string) => new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

export function PublicConsentForm({ token }: { token: string }) {
  const query = useQuery({ queryKey: ['public-consent', token], queryFn: () => apiRequest<{ data: PublicConsent }>(`/public/consents/${encodeURIComponent(token)}`), retry: false });
  if (query.isLoading) return <div className="mx-auto h-96 max-w-3xl animate-pulse rounded-2xl bg-white shadow-sm" />;
  if (query.isError) return <StateCard title="This consent link is unavailable" message={query.error.message} />;
  if (!query.data || query.data.data.completed) return <StateCard title="Consent submitted" message="Thank you. Your signature has been securely sent to the clinic." success />;
  return <ConsentDocument token={token} consent={query.data.data} />;
}

function ConsentDocument({ token, consent }: { token: string; consent: Extract<PublicConsent, { completed: false }> }) {
  const blocks = useMemo(() => parseConsentText(consent.template.consentText), [consent.template.consentText]);
  const statementCount = blocks.filter((block) => block.kind === 'statement').length;
  const [acknowledged, setAcknowledged] = useState<Set<number>>(new Set());
  const [signerName, setSignerName] = useState(consent.patient.fullName);
  const [signature, setSignature] = useState('');
  const allAcknowledged = statementCount > 0 && acknowledged.size === statementCount;
  const toggle = (index: number) => setAcknowledged((current) => { const next = new Set(current); if (next.has(index)) next.delete(index); else next.add(index); return next; });
  const submit = useMutation({ mutationFn: () => apiRequest<{ data: { completed: true } }>(`/public/consents/${encodeURIComponent(token)}/sign`, { method: 'POST', body: JSON.stringify({ signerName: signerName.trim(), signatureBase64: signature }) }) });

  if (submit.isSuccess) return <StateCard title="Consent submitted" message="Thank you. The clinic has received your signed consent and will complete it with the treating doctor." success />;

  return <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border bg-white shadow-xl">
    <div className="border-b bg-white px-5 py-5 text-center sm:px-10">
      <img src="/revive-logo.png" alt="Revive Skin & Hair Clinic" className="mx-auto h-16 w-auto object-contain" />
      <h1 className="mt-4 text-lg font-bold uppercase tracking-wide text-[#241417]">{consent.template.name}</h1>
      <p className="mt-1 text-xs text-neutral-500">Version {consent.template.version} · Link valid until {formatDate(consent.expiresAt)}</p>
    </div>
    <div className="space-y-5 p-5 sm:p-10">
      <dl className="grid gap-3 rounded-xl border border-[#241417]/60 p-4 text-sm sm:grid-cols-3">
        <div className="sm:col-span-3"><dt className="text-xs text-neutral-500">Patient</dt><dd className="font-semibold">{consent.patient.fullName} ({consent.patient.patientNo})</dd></div>
        <div><dt className="text-xs text-neutral-500">Date</dt><dd className="font-semibold">{formatDate(new Date())}</dd></div>
        <div><dt className="text-xs text-neutral-500">Age</dt><dd className="font-semibold">{consent.patient.age ?? 'Not recorded'}</dd></div>
        <div><dt className="text-xs text-neutral-500">Sex</dt><dd className="font-semibold">{consent.patient.sex ? consent.patient.sex.charAt(0) + consent.patient.sex.slice(1).toLowerCase() : 'Not recorded'}</dd></div>
        <div className="border-t pt-3 sm:col-span-3"><dt className="text-xs text-neutral-500">Treatment</dt><dd className="font-semibold">{consent.treatmentName}</dd></div>
      </dl>
      <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-950"><ShieldCheck className="mt-0.5 size-5 shrink-0" /><p>Please read every statement and tick it to confirm that you understand it. Your signature unlocks after all statements are acknowledged.</p></div>
      <div className="space-y-1">{blocks.map((block, index) => {
        if (block.kind === 'heading') return <h2 key={index} className="pt-4 text-xs font-bold uppercase tracking-wider text-primary">{block.text}</h2>;
        if (block.kind === 'paragraph') return <p key={index} className="pt-1 text-[15px] leading-relaxed text-neutral-700">{block.text}</p>;
        const checked = acknowledged.has(block.statementIndex!);
        return <label key={index} className={cn('flex cursor-pointer items-start gap-3 rounded-lg p-2 text-[15px] leading-relaxed', checked ? 'bg-primary/[0.05]' : 'hover:bg-neutral-50')}>
          <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggle(block.statementIndex!)} />
          <span className={cn('mt-1 grid size-[18px] shrink-0 place-items-center rounded border-2', checked ? 'border-primary bg-primary text-white' : 'border-neutral-400')}>{checked ? <Check className="size-3" strokeWidth={3} /> : null}</span><span>{block.text}</span>
        </label>;
      })}</div>
      <section className="border-t border-dashed pt-6">
        <h2 className="font-semibold">Signature of Patient</h2>
        <Input className="mt-2" value={signerName} onChange={(event) => setSignerName(event.target.value)} placeholder="Patient / signer name" />
        <div className="mt-2"><SignaturePad disabled={!allAcknowledged} disabledLabel="Acknowledge all statements first" onChange={setSignature} /></div>
      </section>
      {submit.isError ? <p role="alert" className="text-sm text-red-700">{submit.error.message}</p> : null}
      <Button className="w-full" disabled={!allAcknowledged || !signature || signerName.trim().length < 2 || submit.isPending} onClick={() => submit.mutate()}><FileSignature className="size-4" />{submit.isPending ? 'Submitting securely…' : 'Sign and submit consent'}</Button>
      <p className="text-center text-xs text-neutral-500">Your signature is encrypted and added to your clinic record. The treating doctor will countersign it at the clinic.</p>
    </div>
  </div>;
}

function StateCard({ title, message, success = false }: { title: string; message: string; success?: boolean }) {
  return <div className="mx-auto mt-16 max-w-md rounded-2xl border bg-white p-8 text-center shadow-lg">{success ? <CheckCircle2 className="mx-auto size-12 text-emerald-600" /> : <FileSignature className="mx-auto size-12 text-primary" />}<h1 className="mt-4 text-xl font-semibold">{title}</h1><p className="mt-2 text-sm text-muted-foreground">{message}</p></div>;
}
