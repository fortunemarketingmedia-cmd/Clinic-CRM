'use client';

import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { SegmentedTabs } from '@/components/ui/data-visuals';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { apiRequest } from '@/services/api';
import type { Branch } from '@/types/branch';
import type { Patient } from '@/types/patient';
import type { Lead } from '@/types/lead';

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
  const [search, setSearch] = useState('');
  const [branchId, setBranchId] = useState('');
  const [status, setStatus] = useState('');
  const [recordTab, setRecordTab] = useState<'PATIENTS' | 'LEADS'>('PATIENTS');

  const branchesQuery = useQuery({ queryKey: ['branches'], queryFn: () => apiRequest<{ data: Branch[] }>('/branches') });
  const analyticsQuery = useQuery({
    queryKey: ['clients-analytics'],
    queryFn: () => apiRequest<{ data: AnalyticsOverview }>('/analytics'),
  });

  const patientQueryString = useMemo(() => {
    const params = new URLSearchParams();
    if (branchId) params.set('branchId', branchId);
    if (search.trim()) params.set('search', search.trim());
    return params.toString();
  }, [branchId, search]);

  const patientsQuery = useQuery({
    queryKey: ['clients-patients', patientQueryString],
    queryFn: () => apiRequest<{ data: Patient[] }>(`/patients?${patientQueryString}`),
  });

  const leadsQueryString = useMemo(() => {
    const params = new URLSearchParams();
    if (branchId) params.set('branchId', branchId);
    if (search.trim()) params.set('search', search.trim());
    if (status) params.set('status', status);
    return params.toString();
  }, [branchId, search, status]);
  const leadsQuery = useQuery({ queryKey: ['master-leads', leadsQueryString], queryFn: () => apiRequest<{ data: Lead[] }>(`/leads?${leadsQueryString}`) });
  const uniquePatients = useMemo(() => {
    const seen = new Set<string>();
    return (patientsQuery.data?.data ?? []).filter((patient) => {
      const identity = patient.mobile.replace(/\D/g, '').slice(-10) || patient.id;
      if (seen.has(identity)) return false;
      seen.add(identity);
      return true;
    });
  }, [patientsQuery.data]);

  const totals = analyticsQuery.data?.data.totals;

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

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3 lg:flex-row lg:items-center lg:justify-between"><SegmentedTabs tabs={[{ label: 'Patient master', value: 'PATIENTS', count: uniquePatients.length }, { label: 'Lead history', value: 'LEADS', count: leadsQuery.data?.data.length ?? 0 }]} value={recordTab} onChange={setRecordTab} /><p className="px-2 text-sm text-muted-foreground">Patients are unique by identity; repeat enquiries remain as separate lead history.</p></div>

      {recordTab === 'PATIENTS' ? (
      <Card>
        <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_220px_220px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search patient, mobile, or patient no" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <Select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
            <option value="">All branches</option>
            {branchesQuery.data?.data.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </Select>
          <Select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All appointment statuses</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="ARRIVED">Arrived</option>
            <option value="POSTPONED">Postponed</option>
            <option value="NOT_ARRIVED">Not arrived</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
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
              {uniquePatients.map((patient) => (
                <tr key={patient.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="font-medium">{patient.fullName}</div>
                    <div className="text-xs text-muted-foreground">{patient.patientNo}</div>
                  </td>
                  <td className="px-4 py-3">{patient.mobile}</td>
                  <td className="px-4 py-3">{patient.branch?.name}</td>
                  <td className="px-4 py-3">{patient.lead?.source?.replace('_', ' ')}</td>
                  <td className="px-4 py-3">{patient.lead?.status?.replace('_', ' ')}</td>
                </tr>
              ))}
              {!patientsQuery.isLoading && patientsQuery.data?.data.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-muted-foreground" colSpan={5}>
                    No clients found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
      ) : null}

      {recordTab === 'LEADS' ? (
      <Card>
        <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_220px_220px]"><div className="relative"><Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search client or mobile" value={search} onChange={(event) => setSearch(event.target.value)} /></div><Select value={branchId} onChange={(event) => setBranchId(event.target.value)}><option value="">All branches</option>{branchesQuery.data?.data.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</Select><Select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option><option value="CONFIRMED">Confirmed</option><option value="ARRIVED">Arrived</option><option value="POSTPONED">Postponed</option><option value="NOT_ARRIVED">Not arrived</option><option value="CANCELLED">Cancelled</option></Select></div>
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
                    <div className="font-medium">{lead.name}</div>
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
      </Card>
      ) : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-2 text-xl font-semibold">{value}</div>
    </Card>
  );
}
