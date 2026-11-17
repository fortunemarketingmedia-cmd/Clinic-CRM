'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ArrowUpRight, BellRing, CalendarDays, ChevronRight, PhoneCall, UserRoundCheck, Users } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState, type ElementType } from 'react';
import { useQuickAction } from '@/components/layout/quick-actions';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { DonutChart } from '@/components/ui/data-visuals';
import { EmptyState } from '@/components/ui/empty-state';
import { PageSkeleton } from '@/components/ui/skeleton';
import { Select } from '@/components/ui/select';
import { Sparkline } from '@/components/ui/sparkline';
import { StatusBadge, type StatusTone } from '@/components/ui/status-badge';
import { TrendChart } from '@/components/ui/trend-chart';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/services/api';
import { useSessionStore } from '@/store/session-store';

type DashboardOverview = {
  totals: {
    leads: number;
    patients: number;
    appointments: number;
    todayAppointments: number;
    tomorrowAppointments: number;
    monthAppointments: number;
    arrived: number;
    notArrived: number;
    confirmed: number;
    revenue: string | number;
    collected: string | number;
    todayRevenue: string | number;
    monthlyRevenue: string | number;
    pendingFollowups: number;
    totalLeadIntake: number;
    convertedLeads: number;
    leadConversion: number;
  };
  byBranch: Array<{
    id: string;
    name: string;
    activeLeads: number;
    _count: { leads: number; appointments: number; patients: number; invoices: number };
  }>;
  upcomingAppointments: Array<{
    id: string;
    appointmentAt: string;
    status: string;
    resourceType?: 'CONSULTATION' | 'TREATMENT_ROOM';
    roomNumber?: number | null;
    branch: { name: string };
    lead: { name: string; mobile: string; source: string };
  }>;
  recentPatients: Array<{
    id: string;
    patientNo: string;
    fullName: string;
    mobile: string;
    branch: { name: string };
  }>;
  analytics?: { trend: Array<{ date: string; leads: number; patients: number; appointments: number; followUps: number }> };
  dailyWork?: {
    todaysFollowups: Array<{
      id: string;
      name: string;
      mobile: string;
      nextFollowupAt?: string | null;
    }>;
    missedFollowups: Array<{
      id: string;
      name: string;
      mobile: string;
      nextFollowupAt?: string | null;
    }>;
    newLeadsNotContacted: Array<{ id: string; name: string; mobile: string }>;
    postponedAppointments: Array<{
      id: string;
      appointmentAt: string;
      lead: { name: string; mobile: string };
    }>;
    notArrivedPatients: Array<{
      id: string;
      appointmentAt: string;
      lead: { name: string; mobile: string };
    }>;
  };
};


const timeOnly = (value: string) => new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));

const statusTone = (status: string): StatusTone =>
  status === 'CHECKED_IN' || status === 'COMPLETED' ? 'success'
  : status === 'NO_SHOW' || status === 'CANCELLED' ? 'danger'
  : status === 'RESCHEDULED' ? 'warning'
  : status === 'WAITING' || status === 'IN_CONSULTATION' ? 'info'
  : 'primary';

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

function KpiCard({ label, value, hint, icon: Icon, series, variant, color, hero = false }: { label: string; value: string | number; hint: string; icon: ElementType; series: number[]; variant: 'line' | 'area' | 'bars'; color: string; hero?: boolean }) {
  return (
    <Card className={cn('flex flex-col justify-between gap-3 overflow-hidden p-4 sm:p-5', hero && 'border-transparent bg-[linear-gradient(135deg,#238F88_0%,#14606B_55%,#0F4A55_100%)] text-white')}>
      <div className="flex items-center gap-2.5">
        <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', hero ? 'bg-white/15 text-white' : 'bg-primary-soft text-primary')}><Icon className="size-4" aria-hidden /></span>
        <span className={cn('truncate text-[13px] font-medium', hero ? 'text-white/85' : 'text-muted-foreground')}>{label}</span>
      </div>
      <div>
        <div className="text-[32px] font-semibold leading-none tracking-tight tabular-nums">{value}</div>
        <div className={cn('mt-1.5 text-xs', hero ? 'text-white/75' : 'text-muted-foreground')}>{hint}</div>
      </div>
      <Sparkline values={series} color={hero ? '#FFFFFF' : color} variant={hero ? 'area' : variant} />
    </Card>
  );
}

export function DashboardView() {
  const { session, selectedBranchId } = useSessionStore();
  const openQuickAction = useQuickAction();
  const isAdmin = session?.user.role === 'ADMIN';
  const branchId = selectedBranchId ?? '';
  const [period, setPeriod] = useState<'TODAY' | '7_DAYS' | '30_DAYS' | 'THIS_MONTH' | 'ALL'>('30_DAYS');

  const analyticsQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (branchId) params.set('branchId', branchId);
    if (period !== 'ALL') {
      const end = new Date();
      const start = new Date(end);
      if (period === 'TODAY') start.setHours(0, 0, 0, 0);
      if (period === '7_DAYS') start.setDate(start.getDate() - 6);
      if (period === '30_DAYS') start.setDate(start.getDate() - 29);
      if (period === 'THIS_MONTH') start.setDate(1);
      if (period === 'THIS_MONTH') start.setHours(0, 0, 0, 0);
      params.set('dateFrom', start.toISOString());
      params.set('dateTo', end.toISOString());
    }
    return params.toString();
  }, [branchId, period]);

  const dashboardQuery = useQuery({
    queryKey: ['dashboard-overview', analyticsQuery],
    queryFn: () =>
      apiRequest<{ data: DashboardOverview }>(`/analytics/dashboard${analyticsQuery ? `?${analyticsQuery}` : ''}`),
  });


  const totals = dashboardQuery.data?.data.totals;
  const dailyWork = dashboardQuery.data?.data.dailyWork;

  if (dashboardQuery.isLoading) return <PageSkeleton />;
  if (dashboardQuery.isError) return <EmptyState icon={AlertCircle} title="The dashboard could not be loaded" description="Check your connection and try again. Your data is unchanged." action={<Button type="button" onClick={() => void dashboardQuery.refetch()}>Try again</Button>} />;

  const data = dashboardQuery.data?.data;
  const upcoming = data?.upcomingAppointments ?? [];
  const trend = (data?.analytics?.trend ?? []).map((point) => ({
    ...point,
    label: new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(new Date(`${point.date}T12:00:00`)),
  }));
  const seriesOf = (key: 'leads' | 'patients' | 'appointments' | 'followUps') => trend.map((point) => point[key]);
  const nameParts = (session?.user.name ?? '').split(' ').filter(Boolean);
  const firstName = /^(dr|mr|mrs|ms)\.?$/i.test(nameParts[0] ?? '') ? nameParts.slice(0, 2).join(' ') : (nameParts[0] ?? '');
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const todayCount = totals?.todayAppointments ?? 0;
  const headline = todayCount
    ? `${todayCount} ${todayCount === 1 ? 'Appointment' : 'Appointments'} Today${totals?.pendingFollowups ? `, ${totals.pendingFollowups} Follow-ups Pending` : ''}`
    : totals?.pendingFollowups ? `No Appointments Today, ${totals.pendingFollowups} Follow-ups Pending` : 'No Appointments Scheduled Today';

  const kpis = [
    { label: "Today's appointments", value: todayCount, hint: `${totals?.tomorrowAppointments ?? 0} scheduled for tomorrow`, icon: CalendarDays, series: seriesOf('appointments'), variant: 'area' as const, color: '#176B78', hero: true },
    isAdmin
      ? { label: 'Patients', value: totals?.patients ?? 0, hint: `${data?.analytics ? trend.reduce((sum, p) => sum + p.patients, 0) : 0} new in this period`, icon: UserRoundCheck, series: seriesOf('patients'), variant: 'bars' as const, color: '#24966F' }
      : { label: 'Waiting patients', value: totals?.confirmed ?? 0, hint: `${totals?.arrived ?? 0} already arrived`, icon: UserRoundCheck, series: seriesOf('appointments'), variant: 'bars' as const, color: '#24966F' },
    { label: 'Unconverted leads', value: totals?.leads ?? 0, hint: `${totals?.convertedLeads ?? 0} converted to patients in this period`, icon: Users, series: seriesOf('leads'), variant: 'area' as const, color: '#D69A36' },
    { label: isAdmin ? 'Pending follow-ups' : "Today's follow-ups", value: totals?.pendingFollowups ?? 0, hint: `${dailyWork?.missedFollowups.length ?? 0} missed`, icon: PhoneCall, series: seriesOf('followUps'), variant: 'line' as const, color: '#4B99C5' },
  ];

  const workGroups = isAdmin
    ? [
        { title: 'Postponed appointments', href: '/appointments', rows: (dailyWork?.postponedAppointments ?? []).map((a) => a.lead.name) },
        { title: 'Campaign follow-ups today', href: '/notifications', rows: (dailyWork?.todaysFollowups ?? []).map((l) => l.name) },
        { title: 'Not arrived patients', href: '/appointments', rows: (dailyWork?.notArrivedPatients ?? []).map((a) => a.lead.name) },
      ]
    : [
        { title: "Today's follow-ups", href: '/notifications', rows: (dailyWork?.todaysFollowups ?? []).map((l) => l.name) },
        { title: 'Missed follow-ups', href: '/notifications', rows: (dailyWork?.missedFollowups ?? []).map((l) => l.name) },
        { title: 'New leads not contacted', href: '/leads', rows: (dailyWork?.newLeadsNotContacted ?? []).map((l) => l.name) },
      ];
  const workTotal = workGroups.reduce((sum, group) => sum + group.rows.length, 0);

  const outcome = [
    { label: 'Confirmed', value: totals?.confirmed ?? 0, color: '#4B99C5' },
    { label: 'Arrived', value: totals?.arrived ?? 0, color: '#24966F' },
    { label: 'Not arrived', value: totals?.notArrived ?? 0, color: '#D85D6A' },
  ];
  const outcomeTotal = outcome.reduce((sum, item) => sum + item.value, 0);
  const periodAppointments = trend.reduce((sum, point) => sum + point.appointments, 0);

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1>{headline}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{greeting}{firstName ? `, ${firstName}` : ''} — {isAdmin ? 'clinic performance, appointments and lead conversion at a glance.' : "today's front desk work and upcoming appointments."}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <label className="flex h-10 items-center gap-2 rounded-full bg-white/80 pl-4 pr-1 text-sm ring-1 ring-white">
            <CalendarDays className="size-4 text-muted-foreground" aria-hidden />
            <Select className="h-9 w-36 border-0 bg-transparent px-1 shadow-none focus:ring-0" aria-label="Dashboard period" value={period} onChange={(event) => setPeriod(event.target.value as typeof period)}>
              <option value="TODAY">Today</option><option value="7_DAYS">Last 7 days</option><option value="30_DAYS">Last 30 days</option><option value="THIS_MONTH">This month</option><option value="ALL">All time</option>
            </Select>
          </label>
          <button type="button" onClick={() => openQuickAction('appointment')} className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-white transition-colors hover:bg-primary-hover"><CalendarDays className="size-4" aria-hidden />Book appointment</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
        <Card className="sm:p-6">
          <CardHeader
            title="Clinic activity"
            description="Appointments, new leads and new patients per day"
            action={<Link href="/reports" className="inline-flex h-8 items-center gap-1 rounded-full bg-muted px-3 text-xs font-medium text-foreground hover:bg-primary-soft">Detailed analytics <ArrowUpRight className="size-3.5" aria-hidden /></Link>}
          />
          <div className="mb-3 flex items-baseline gap-2"><span className="text-[34px] font-semibold leading-none tracking-tight tabular-nums">{periodAppointments}</span><span className="text-sm text-muted-foreground">appointments in this period</span></div>
          {trend.length > 1 ? (
            <TrendChart data={trend} series={[{ key: 'appointments', label: 'Appointments', color: '#176B78' }, { key: 'leads', label: 'New leads', color: '#D69A36' }, { key: 'patients', label: 'New patients', color: '#4B99C5' }]} />
          ) : <EmptyState icon={CalendarDays} title="Not enough activity yet" description="The chart appears once the selected period has at least two days of records." />}
        </Card>

        <Card className="flex flex-col sm:p-6">
          <CardHeader title="Appointment outcome" description="Current service flow" />
          <div className="flex flex-1 flex-col justify-center"><DonutChart centerLabel="appointments" centerValue={totals?.appointments ?? 0} data={outcome} /></div>
          <div className="mt-5 grid grid-cols-3 divide-x divide-border border-t border-border pt-4 text-center">
            {outcome.map((item) => (
              <div key={item.label} className="px-1"><i className="mx-auto mb-1.5 block size-2 rounded-full" style={{ background: item.color }} /><div className="text-lg font-semibold tabular-nums">{pct(item.value, outcomeTotal)}%</div><div className="text-[11px] text-muted-foreground">{item.label}</div></div>
            ))}
          </div>
          <p className="mt-4 rounded-xl bg-muted/70 px-3 py-2 text-xs text-muted-foreground">Lead conversion is <b className="text-foreground">{totals?.leadConversion ?? 0}%</b> — {totals?.convertedLeads ?? 0} of {totals?.totalLeadIntake ?? 0} enquiries became patients.</p>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="overflow-hidden p-0 sm:p-0">
          <div className="bg-[linear-gradient(180deg,#E4F5F1_0%,#FFFFFF_100%)] px-5 pb-3 pt-5 sm:px-6 sm:pt-6">
            <div className="flex items-center gap-2 text-[15px] font-semibold"><BellRing className="size-4 text-primary" aria-hidden />Today&apos;s work</div>
            <div className="mt-3 flex items-baseline gap-2"><span className="text-[34px] font-semibold leading-none tracking-tight tabular-nums">{workTotal}</span><span className="text-sm text-muted-foreground">{workTotal === 1 ? 'item needs' : 'items need'} attention</span></div>
          </div>
          <ul className="space-y-2 px-4 pb-5 sm:px-5">
            {workGroups.map((group) => (
              <li key={group.title}>
                <Link href={group.href} className="flex items-center gap-3 rounded-2xl bg-muted/60 px-3.5 py-3 transition-colors hover:bg-primary-soft">
                  <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium">{group.title}</span><span className="block truncate text-xs text-muted-foreground">{group.rows.slice(0, 2).join(', ') || 'Nothing pending'}</span></span>
                  <span className="text-sm font-semibold tabular-nums">{group.rows.length}</span><ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="sm:p-6">
          <CardHeader title={isAdmin ? 'Appointment records' : 'Upcoming appointments'} action={<Link href="/appointments" className="inline-flex h-8 items-center rounded-full bg-muted px-3 text-xs font-medium hover:bg-primary-soft">View all</Link>} />
          {upcoming.length ? (
            <ul className="divide-y divide-border">
              {upcoming.slice(0, 5).map((appointment) => (
                <li key={appointment.id} className="flex items-center gap-3 py-3">
                  <div className="w-[4.75rem] shrink-0 whitespace-nowrap text-[13px] font-semibold tabular-nums">{timeOnly(appointment.appointmentAt)}<div className="text-[11px] font-normal text-muted-foreground">{new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(new Date(appointment.appointmentAt))}</div></div>
                  <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{appointment.lead.name}</div><div className="truncate text-xs text-muted-foreground">{appointment.resourceType === 'TREATMENT_ROOM' ? `Room ${appointment.roomNumber}` : 'Consultation'} · {appointment.branch.name}</div></div>
                  <StatusBadge tone={statusTone(appointment.status)} className="capitalize">{appointment.status.replaceAll('_', ' ').toLowerCase()}</StatusBadge>
                </li>
              ))}
            </ul>
          ) : <EmptyState icon={CalendarDays} title="No upcoming appointments" description="New bookings will appear here." />}
        </Card>

        <Card className="sm:p-6">
          <CardHeader title="Recent patients" action={<Link href="/clients" className="inline-flex h-8 items-center rounded-full bg-muted px-3 text-xs font-medium hover:bg-primary-soft">View all</Link>} />
          {data?.recentPatients.length ? (
            <ul className="divide-y divide-border">
              {data.recentPatients.slice(0, 5).map((patient) => (
                <li key={patient.id}>
                  <Link href={`/patients/${patient.id}`} className="flex items-center gap-3 py-3 transition-colors hover:text-primary">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-xs font-semibold text-primary">{patient.fullName.charAt(0).toUpperCase()}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{patient.fullName}</span><span className="block truncate text-xs text-muted-foreground">{patient.branch.name}</span></span>
                    <span className="text-xs font-medium tabular-nums text-muted-foreground">{patient.patientNo}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <EmptyState icon={Users} title="No patients registered yet" description="New patient profiles will appear here." />}
        </Card>
      </div>

      {isAdmin && (data?.byBranch.length ?? 0) > 0 ? (
        <Card className="sm:p-6">
          <CardHeader title="Branch overview" description="Activity per branch" />
          <div className="grid gap-3 md:grid-cols-2">
            {data?.byBranch.map((branch) => (
              <div key={branch.id} className="flex items-center justify-between gap-3 rounded-2xl bg-muted/60 px-4 py-3.5">
                <div className="min-w-0"><div className="truncate text-sm font-medium">{branch.name}</div><div className="text-xs text-muted-foreground">{branch.activeLeads} active leads</div></div>
                <div className="flex shrink-0 gap-6 text-right text-xs text-muted-foreground">
                  <div><div className="text-lg font-semibold tabular-nums text-foreground">{branch._count.patients}</div>patients</div>
                  <div><div className="text-lg font-semibold tabular-nums text-foreground">{branch._count.appointments}</div>appointments</div>
                  <div><div className="text-lg font-semibold tabular-nums text-foreground">{branch._count.leads}</div>leads</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </section>
  );
}
