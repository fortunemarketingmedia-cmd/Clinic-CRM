'use client';

import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SegmentedTabs } from '@/components/ui/data-visuals';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PageSkeleton } from '@/components/ui/skeleton';
import { apiRequest } from '@/services/api';
import { useSessionStore } from '@/store/session-store';
import { QrRegistrationForm } from '@/modules/qr/qr-registration-form';
import type { Patient } from '@/types/patient';
import type { Lead } from '@/types/lead';
import { PaginationControls, type PaginationMeta } from '@/components/ui/pagination-controls';

type AnalyticsOverview = {
  totals: {
    leads: number;
    patients: number;
    appointments: number;
    arrived: number;
    notArrived: number;
    confirmed: number;
    revenue: string | number;
    collected: string | number;
  };
};

function money(value?: string | number) {
  return `Rs ${Number(value ?? 0).toLocaleString('en-IN')}`;
}

export function ClientsView() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [recordTab, setRecordTab] = useState<'PATIENTS' | 'LEADS'>('PATIENTS');
  const [showCreatePatient, setShowCreatePatient] = useState(false);
  const [patientPage, setPatientPage] = useState(1);
  const [leadPage, setLeadPage] = useState(1);
  const { selectedBranchId, session, hasHydrated } = useSessionStore();
  const branchId = selectedBranchId ?? '';
  const branchReady = hasHydrated && Boolean(session) && (session?.user.role === 'ADMIN' || Boolean(branchId));

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);
  useEffect(() => { setPatientPage(1); setLeadPage(1); }, [branchId, debouncedSearch, status, source, dateFrom, dateTo]);

  const analyticsQuery = useQuery({
    queryKey: ['clients-analytics', branchId],
    queryFn: () => apiRequest<{ data: AnalyticsOverview }>(`/analytics${branchId ? `?branchId=${branchId}` : ''}`),
    enabled: branchReady,
  });

  const patientQueryString = useMemo(() => {
    const params = new URLSearchParams();
    if (branchId) params.set('branchId', branchId);
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (status) params.set('leadStatus', status);
    if (source) params.set('leadSource', source);
    params.set('page', String(patientPage));
    params.set('pageSize', '50');
    return params.toString();
  }, [branchId, debouncedSearch, patientPage, source, status]);

  const patientsQuery = useQuery({
    queryKey: ['clients-patients', patientQueryString],
    queryFn: () => apiRequest<{ data: Patient[]; meta: PaginationMeta }>(`/patients?${patientQueryString}`),
    placeholderData: keepPreviousData,
    enabled: branchReady,
  });

  const leadsQueryString = useMemo(() => {
    const params = new URLSearchParams();
    if (branchId) params.set('branchId', branchId);
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (status) params.set('status', status);
    if (source) params.set('source', source);
    if (dateFrom) params.set('createdFrom', new Date(`${dateFrom}T00:00:00`).toISOString());
    if (dateTo) params.set('createdTo', new Date(`${dateTo}T23:59:59`).toISOString());
    params.set('includeClosed', 'true');
    params.set('page', String(leadPage));
    params.set('pageSize', '50');
    return params.toString();
  }, [branchId, dateFrom, dateTo, debouncedSearch, leadPage, source, status]);
  const leadsQuery = useQuery({ queryKey: ['master-leads', leadsQueryString], queryFn: () => apiRequest<{ data: Lead[]; meta: PaginationMeta }>(`/leads?${leadsQueryString}`), placeholderData: keepPreviousData, enabled: branchReady });
  const uniquePatients = useMemo(() => {
    const seen = new Set<string>();
    return (patientsQuery.data?.data ?? []).filter((patient) => {
      const identity = patient.mobile.replace(/\D/g, '').slice(-10) || patient.id;
      if (seen.has(identity)) return false;
      seen.add(identity);
      return true;
    });
  }, [patientsQuery.data]);
  const visiblePatients = useMemo(() => uniquePatients.filter((patient) =>
    (!status || patient.lead?.status === status) && (!source || patient.lead?.source === source),
  ), [source, status, uniquePatients]);

  const totals = analyticsQuery.data?.data.totals;

  if (analyticsQuery.isLoading || patientsQuery.isLoading || leadsQuery.isLoading) return <PageSkeleton />;

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Master Records</h1>
        <p className="text-sm text-muted-foreground">Master CRM database for every lead, appointment, patient, and clinic record.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Metric label="Patients" value={totals?.patients ?? 0} />
        <Metric label="Enquiries" value={totals?.leads ?? 0} />
        <Metric label="Appointments" value={totals?.appointments ?? 0} />
        <Metric label="Arrived" value={totals?.arrived ?? 0} />
        <Metric label="Not Arrived" value={totals?.notArrived ?? 0} />
        <Metric label="Revenue" value={money(totals?.revenue)} />
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3 lg:flex-row lg:items-center lg:justify-between"><SegmentedTabs tabs={[{ label: 'Patient master', value: 'PATIENTS', count: uniquePatients.length }, { label: 'Lead history', value: 'LEADS', count: leadsQuery.data?.data.length ?? 0 }]} value={recordTab} onChange={setRecordTab} /><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><p className="px-2 text-sm text-muted-foreground">Patient profiles are created only after the registration form is completed.</p>{recordTab === 'PATIENTS' ? <Button type="button" onClick={() => setShowCreatePatient(true)}><Plus className="size-4" />Create Patient</Button> : null}</div></div>

      {showCreatePatient ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-3 sm:p-6">
          <div className="mx-auto flex max-w-3xl justify-end pb-2">
            <Button type="button" variant="secondary" className="w-10 px-0" aria-label="Close patient registration" onClick={() => setShowCreatePatient(false)}><X className="size-4" /></Button>
          </div>
          <div className="mx-auto max-w-3xl">
            <QrRegistrationForm token="clinic" initialBranchId={branchId || undefined} onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['clients-patients'] });
              queryClient.invalidateQueries({ queryKey: ['patients'] });
              queryClient.invalidateQueries({ queryKey: ['clients-analytics'] });
            }} />
          </div>
        </div>
      ) : null}

      {recordTab === 'PATIENTS' ? (
      <Card>
        <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_220px_200px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search patient, mobile, or patient no" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <Select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All patient journeys</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="ARRIVED">Arrived</option>
            <option value="POSTPONED">Postponed</option>
            <option value="NOT_ARRIVED">Not arrived</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
          <SourceFilter value={source} onChange={setSource} />
        </div>

        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Patient</th>
                <th className="px-4 py-3 font-medium">Mobile</th>
                <th className="px-4 py-3 font-medium">Branch</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {visiblePatients.map((patient) => (
                <tr key={patient.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <Link href={`/patients/${patient.id}`} className="font-medium text-primary hover:underline">{patient.fullName}</Link>
                    <div className="text-xs text-muted-foreground">{patient.patientNo}</div>
                  </td>
                  <td className="px-4 py-3">{patient.mobile}</td>
                  <td className="px-4 py-3">{patient.branch?.name}</td>
                  <td className="px-4 py-3">{patient.lead?.source?.replace('_', ' ')}</td>
                  <td className="px-4 py-3">{patient.lead?.status?.replace('_', ' ')}</td>
                </tr>
              ))}
              {!patientsQuery.isLoading && visiblePatients.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-muted-foreground" colSpan={5}>
                    No clients found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <PaginationControls meta={patientsQuery.data?.meta} onPageChange={setPatientPage} />
      </Card>
      ) : null}

      {recordTab === 'LEADS' ? (
      <Card>
        <div className="mb-4 grid gap-3 xl:grid-cols-[minmax(260px,1fr)_190px_180px_150px_150px]"><div className="relative"><Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search name, mobile, or email" value={search} onChange={(event) => setSearch(event.target.value)} /></div><Select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Every lead status</option>{['NEW','UNASSIGNED','ASSIGNED','ATTEMPTING_CONTACT','CONNECTED','QUALIFIED','APPOINTMENT_PROPOSED','APPOINTMENT_BOOKED','NURTURING','BOOKED','CONFIRMED','ARRIVED','CONVERTED','POSTPONED','NOT_ARRIVED','CANCELLED','LOST','DISQUALIFIED'].map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</Select><SourceFilter value={source} onChange={setSource} /><Input aria-label="Created from" title="Created from" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /><Input aria-label="Created to" title="Created to" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></div>
        <h2 className="text-base font-semibold">Complete Lead History</h2>
        <p className="mt-1 text-sm text-muted-foreground">Every enquiry is retained, including repeat leads from an existing or former patient.</p>
        <div className="mt-4 overflow-hidden rounded-md border border-border">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Mobile</th>
                <th className="px-4 py-3 font-medium">Branch</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {leadsQuery.data?.data.map((lead) => (
                <tr key={lead.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <Link href={`/leads/${lead.id}`} className="font-medium text-primary hover:underline">{lead.name}</Link>
                    <div className="text-xs text-muted-foreground">{lead.interestedTreatment ?? 'General enquiry'}</div>
                  </td>
                  <td className="px-4 py-3">{lead.mobile}</td>
                  <td className="px-4 py-3">{lead.branch?.name}</td>
                  <td className="px-4 py-3">{new Date(lead.createdAt).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3">{lead.source.replaceAll('_', ' ')}</td>
                  <td className="px-4 py-3">{lead.status.replaceAll('_', ' ')}</td>
                </tr>
              ))}
              {!leadsQuery.isLoading && leadsQuery.data?.data.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>
                    No lead records found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <PaginationControls meta={leadsQuery.data?.meta} onPageChange={setLeadPage} />
      </Card>
      ) : null}
    </section>
  );
}

function SourceFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <Select aria-label="Lead source" value={value} onChange={(event) => onChange(event.target.value)}><option value="">All sources</option>{['WEBSITE','WALK_IN','PHONE_CALL','WHATSAPP','GOOGLE_ADS','META_ADS','OTHER'].map((source) => <option key={source} value={source}>{source.replaceAll('_', ' ')}</option>)}</Select>;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-2 text-xl font-semibold">{value}</div>
    </Card>
  );
}
