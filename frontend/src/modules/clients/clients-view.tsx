'use client';

import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { apiRequest } from '@/services/api';
import type { Appointment } from '@/types/appointment';
import type { Branch } from '@/types/branch';
import type { Patient } from '@/types/patient';

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

  const appointmentQueryString = useMemo(() => {
    const params = new URLSearchParams();
    if (branchId) params.set('branchId', branchId);
    if (search.trim()) params.set('search', search.trim());
    if (status) params.set('status', status);
    return params.toString();
  }, [branchId, search, status]);

  const appointmentsQuery = useQuery({
    queryKey: ['clients-appointments', appointmentQueryString],
    queryFn: () => apiRequest<{ data: Appointment[] }>(`/appointments?${appointmentQueryString}`),
  });

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
              {patientsQuery.data?.data.map((patient) => (
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

      <Card>
        <h2 className="text-base font-semibold">Appointment / Enquiry Records</h2>
        <div className="mt-4 overflow-hidden rounded-md border border-border">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Mobile</th>
                <th className="px-4 py-3 font-medium">Branch</th>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {appointmentsQuery.data?.data.map((appointment) => (
                <tr key={appointment.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="font-medium">{appointment.lead?.name}</div>
                    <div className="text-xs text-muted-foreground">{appointment.lead?.source?.replace('_', ' ')}</div>
                  </td>
                  <td className="px-4 py-3">{appointment.lead?.mobile}</td>
                  <td className="px-4 py-3">{appointment.branch?.name}</td>
                  <td className="px-4 py-3">{new Date(appointment.appointmentAt).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3">{appointment.status.replace('_', ' ')}</td>
                </tr>
              ))}
              {!appointmentsQuery.isLoading && appointmentsQuery.data?.data.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-muted-foreground" colSpan={5}>
                    No appointment records found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
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
