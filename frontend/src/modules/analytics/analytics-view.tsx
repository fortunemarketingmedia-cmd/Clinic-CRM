'use client';

import { useQuery } from '@tanstack/react-query';
import { BarChart3, CalendarDays, IndianRupee, PhoneCall, UserRoundCheck, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { apiRequest } from '@/services/api';
import type { Branch } from '@/types/branch';

type AnalyticsOverview = {
  totals: {
    leads: number;
    patients: number;
    appointments: number;
    todayAppointments: number;
    tomorrowAppointments: number;
    monthAppointments: number;
    arrived: number;
    notArrived: number;
    cancelled: number;
    confirmed: number;
    revenue: string | number;
    collected: string | number;
    pendingFollowups: number;
  };
  byBranch: Array<{
    id: string;
    name: string;
    _count: { leads: number; appointments: number; patients: number; invoices: number };
  }>;
};

function money(value?: string | number) {
  return `Rs ${Number(value ?? 0).toLocaleString('en-IN')}`;
}

export function AnalyticsView() {
  const [branchId, setBranchId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const branchesQuery = useQuery({
    queryKey: ['branches'],
    queryFn: () => apiRequest<{ data: Branch[] }>('/branches'),
  });
  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (branchId) params.set('branchId', branchId);
    if (dateFrom) params.set('dateFrom', new Date(`${dateFrom}T00:00:00`).toISOString());
    if (dateTo) params.set('dateTo', new Date(`${dateTo}T23:59:59`).toISOString());
    return params.toString();
  }, [branchId, dateFrom, dateTo]);

  const analyticsQuery = useQuery({
    queryKey: ['analytics-overview', queryString],
    queryFn: () => apiRequest<{ data: AnalyticsOverview }>(`/analytics${queryString ? `?${queryString}` : ''}`),
  });

  const totals = analyticsQuery.data?.data.totals;
  const metrics = [
    { label: 'Total Patients', value: totals?.patients ?? 0, icon: UserRoundCheck },
    { label: 'Total Enquiries', value: totals?.leads ?? 0, icon: PhoneCall },
    { label: 'Appointments', value: totals?.appointments ?? 0, icon: CalendarDays },
    { label: 'This Month', value: totals?.monthAppointments ?? 0, icon: CalendarDays },
    { label: 'Revenue', value: money(totals?.revenue), icon: IndianRupee },
    { label: 'Collected', value: money(totals?.collected), icon: IndianRupee },
    { label: 'Confirmed', value: totals?.confirmed ?? 0, icon: BarChart3 },
    { label: 'Arrived', value: totals?.arrived ?? 0, icon: UserRoundCheck },
    { label: 'Not Arrived', value: totals?.notArrived ?? 0, icon: XCircle },
  ];

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <p className="text-sm text-muted-foreground">Owner overview for patients, clients, appointments, revenue, and branch operations.</p>
      </div>

      <Card>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="block space-y-2">
            <span className="text-sm font-medium">Date from</span>
            <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium">Date to</span>
            <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium">Branch</span>
            <Select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
              <option value="">All branches</option>
              {branchesQuery.data?.data.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </Select>
          </label>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">{metric.label}</div>
                <div className="mt-2 text-2xl font-semibold">{metric.value}</div>
              </div>
              <metric.icon className="size-5 text-primary" />
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <h2 className="font-semibold">Branch Breakdown</h2>
        <div className="mt-4 overflow-hidden rounded-md border border-border">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Branch</th>
                <th className="px-4 py-3 font-medium">Enquiries</th>
                <th className="px-4 py-3 font-medium">Appointments</th>
                <th className="px-4 py-3 font-medium">Patients</th>
                <th className="px-4 py-3 font-medium">Invoices</th>
              </tr>
            </thead>
            <tbody>
              {analyticsQuery.data?.data.byBranch.map((branch) => (
                <tr key={branch.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{branch.name}</td>
                  <td className="px-4 py-3">{branch._count.leads}</td>
                  <td className="px-4 py-3">{branch._count.appointments}</td>
                  <td className="px-4 py-3">{branch._count.patients}</td>
                  <td className="px-4 py-3">{branch._count.invoices}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}
