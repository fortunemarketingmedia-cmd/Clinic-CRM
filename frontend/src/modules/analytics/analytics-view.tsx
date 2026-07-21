'use client';

import { useQuery } from '@tanstack/react-query';
import { Activity, BarChart3, CalendarDays, IndianRupee, PhoneCall, RefreshCcw, TrendingUp, UserRoundCheck, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ColumnChart, DonutChart, HorizontalBarChart, SegmentedTabs } from '@/components/ui/data-visuals';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { apiRequest } from '@/services/api';
import type { Branch } from '@/types/branch';

type AnalyticsOverview = {
  totals: { leads: number; patients: number; appointments: number; todayAppointments: number; tomorrowAppointments: number; monthAppointments: number; arrived: number; notArrived: number; cancelled: number; confirmed: number; revenue: string | number; collected: string | number; pendingFollowups: number; convertedLeads?: number; leadConversion?: number };
  byBranch: Array<{ id: string; name: string; activeLeads?: number; _count: { leads: number; appointments: number; patients: number; invoices: number } }>;
};

type AnalyticsTab = 'OVERVIEW' | 'BRANCHES' | 'FUNNEL';
function money(value?: string | number) { return `₹${Number(value ?? 0).toLocaleString('en-IN')}`; }
function dateKey(date: Date) { return date.toISOString().slice(0, 10); }

export function AnalyticsView() {
  const [branchId, setBranchId] = useState('');
  const [compareBranchId, setCompareBranchId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [tab, setTab] = useState<AnalyticsTab>('OVERVIEW');
  const branchesQuery = useQuery({ queryKey: ['branches'], queryFn: () => apiRequest<{ data: Branch[] }>('/branches') });
  const queryString = useMemo(() => { const params = new URLSearchParams(); if (branchId) params.set('branchId', branchId); if (dateFrom) params.set('dateFrom', new Date(`${dateFrom}T00:00:00`).toISOString()); if (dateTo) params.set('dateTo', new Date(`${dateTo}T23:59:59`).toISOString()); return params.toString(); }, [branchId, dateFrom, dateTo]);
  const analyticsQuery = useQuery({ queryKey: ['analytics-overview', queryString], queryFn: () => apiRequest<{ data: AnalyticsOverview }>(`/analytics${queryString ? `?${queryString}` : ''}`) });
  const totals = analyticsQuery.data?.data.totals;
  const branches = analyticsQuery.data?.data.byBranch ?? [];

  function quickRange(range: 'TODAY' | '7D' | '30D' | 'MONTH') {
    const end = new Date(); const start = new Date();
    if (range === '7D') start.setDate(end.getDate() - 6);
    if (range === '30D') start.setDate(end.getDate() - 29);
    if (range === 'MONTH') start.setDate(1);
    setDateFrom(dateKey(start)); setDateTo(dateKey(end));
  }

  const metrics = [
    { label: 'Total patients', value: totals?.patients ?? 0, icon: UserRoundCheck, note: 'Registered records' },
    { label: 'Lead conversion', value: `${totals?.leadConversion ?? Math.round(((totals?.patients ?? 0) / Math.max(totals?.leads ?? 0, 1)) * 100)}%`, icon: TrendingUp, note: 'Enquiry to patient' },
    { label: 'Appointments', value: totals?.appointments ?? 0, icon: CalendarDays, note: `${totals?.monthAppointments ?? 0} this month` },
    { label: 'Collected revenue', value: money(totals?.collected), icon: IndianRupee, note: `${money(totals?.revenue)} billed` },
  ];

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Clinic intelligence</p><h1 className="mt-1 text-2xl font-semibold">Analytics command centre</h1><p className="text-sm text-muted-foreground">Performance, patient flow, revenue and branch comparison in one decision-ready view.</p></div><div className="text-xs text-muted-foreground">Last refreshed {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div></div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
          <div className="flex flex-wrap gap-2">{(['TODAY', '7D', '30D', 'MONTH'] as const).map((range) => <Button key={range} type="button" variant="secondary" onClick={() => quickRange(range)}>{range === 'MONTH' ? 'This month' : range === 'TODAY' ? 'Today' : `Last ${range.replace('D', '')} days`}</Button>)}</div>
          <div className="grid flex-1 gap-3 sm:grid-cols-3"><Input aria-label="Date from" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /><Input aria-label="Date to" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /><Select aria-label="Branch" value={branchId} onChange={(event) => setBranchId(event.target.value)}><option value="">All branches</option>{branchesQuery.data?.data.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</Select></div>
          <Button type="button" variant="secondary" onClick={() => { setDateFrom(''); setDateTo(''); setBranchId(''); }}><RefreshCcw className="size-4" />Reset</Button>
        </div>
      </Card>

      <SegmentedTabs tabs={[{ label: 'Executive overview', value: 'OVERVIEW' }, { label: 'Branch comparison', value: 'BRANCHES' }, { label: 'Conversion funnel', value: 'FUNNEL' }]} value={tab} onChange={setTab} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map((metric) => <Card key={metric.label}><div className="flex items-start justify-between"><div><div className="text-sm text-muted-foreground">{metric.label}</div><div className="mt-2 text-2xl font-semibold">{metric.value}</div><div className="mt-1 text-xs text-muted-foreground">{metric.note}</div></div><div className="rounded-lg bg-primary/10 p-2 text-primary"><metric.icon className="size-5" /></div></div></Card>)}</div>

      {tab === 'OVERVIEW' ? <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Card><div className="mb-5 flex items-start justify-between"><div><h2 className="font-semibold">Branch activity</h2><p className="text-sm text-muted-foreground">Appointments vs total lead volume</p></div><BarChart3 className="size-5 text-primary" /></div><ColumnChart data={branches.map((branch) => ({ label: branch.name, value: branch._count.appointments, secondaryValue: branch._count.leads }))} /><div className="mt-4 flex gap-4 text-xs text-muted-foreground"><span>■ Appointments</span><span className="opacity-50">■ Leads</span></div></Card>
        <Card><div className="mb-5"><h2 className="font-semibold">Appointment outcomes</h2><p className="text-sm text-muted-foreground">Visibility into attendance quality</p></div><DonutChart centerLabel="total" centerValue={totals?.appointments ?? 0} data={[{ label: 'Confirmed', value: totals?.confirmed ?? 0, color: '#6366f1' }, { label: 'Arrived', value: totals?.arrived ?? 0, color: '#14b8a6' }, { label: 'Not arrived', value: totals?.notArrived ?? 0, color: '#f59e0b' }, { label: 'Cancelled', value: totals?.cancelled ?? 0, color: '#e73748' }]} /></Card>
      </div> : null}

      {tab === 'BRANCHES' ? <div className="grid gap-5 xl:grid-cols-[340px_1fr]"><Card><h2 className="font-semibold">Compare branches</h2><p className="mt-1 text-sm text-muted-foreground">Select a focus branch; bars retain the network benchmark.</p><div className="mt-5 space-y-4"><Select value={compareBranchId} onChange={(event) => setCompareBranchId(event.target.value)}><option value="">Select comparison branch</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</Select>{compareBranchId ? (() => { const branch = branches.find((item) => item.id === compareBranchId); return branch ? <div className="grid grid-cols-2 gap-3"><MiniMetric label="Leads" value={branch._count.leads} /><MiniMetric label="Appointments" value={branch._count.appointments} /><MiniMetric label="Patients" value={branch._count.patients} /><MiniMetric label="Invoices" value={branch._count.invoices} /></div> : null; })() : <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Choose a branch to inspect.</div>}</div></Card><Card><h2 className="font-semibold">Cross-branch comparison</h2><p className="mb-5 text-sm text-muted-foreground">Patient acquisition and appointment throughput</p><HorizontalBarChart data={branches.map((branch) => ({ label: branch.name, value: branch._count.patients, secondaryValue: branch._count.appointments }))} /></Card></div> : null}

      {tab === 'FUNNEL' ? <div className="grid gap-5 lg:grid-cols-3"><Card className="lg:col-span-2"><div className="mb-5"><h2 className="font-semibold">Clinic conversion funnel</h2><p className="text-sm text-muted-foreground">Identify the stage where prospects drop away</p></div><HorizontalBarChart data={[{ label: 'Enquiries', value: totals?.leads ?? 0, color: '#6366f1' }, { label: 'Appointments booked', value: totals?.appointments ?? 0, color: '#0ea5e9' }, { label: 'Arrived at clinic', value: totals?.arrived ?? 0, color: '#14b8a6' }, { label: 'Converted patients', value: totals?.convertedLeads ?? totals?.patients ?? 0, color: '#e73748' }]} /></Card><Card><h2 className="font-semibold">Operational signals</h2><div className="mt-4 space-y-3"><Signal icon={PhoneCall} label="Pending follow-ups" value={totals?.pendingFollowups ?? 0} /><Signal icon={CalendarDays} label="Tomorrow" value={totals?.tomorrowAppointments ?? 0} /><Signal icon={XCircle} label="No-shows" value={totals?.notArrived ?? 0} /><Signal icon={Activity} label="Arrived" value={totals?.arrived ?? 0} /></div></Card></div> : null}
    </section>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) { return <div className="rounded-lg border border-border p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-xl font-semibold">{value}</div></div>; }
function Signal({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: number }) { return <div className="flex items-center justify-between rounded-lg border border-border p-3"><span className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="size-4 text-primary" />{label}</span><strong>{value}</strong></div>; }
