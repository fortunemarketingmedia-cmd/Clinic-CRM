'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Banknote,
  CalendarCheck,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  IndianRupee,
  RefreshCcw,
  TrendingUp,
  UserRoundCheck,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  ColumnChart,
  DonutChart,
  HorizontalBarChart,
  LineChart,
  SegmentedTabs,
} from '@/components/ui/data-visuals';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { apiRequest } from '@/services/api';
import { useSessionStore } from '@/store/session-store';
import type { Branch } from '@/types/branch';

type Breakdown = Array<{ name: string; count: number; amount?: number }>;
type TrendPoint = {
  date: string;
  leads: number;
  patients: number;
  appointments: number;
  followUps: number;
  billed: number;
  collected: number;
};
type AnalyticsOverview = {
  totals: {
    leads: number;
    totalLeadIntake: number;
    convertedLeads: number;
    leadConversion: number;
    patients: number;
    appointments: number;
    arrived: number;
    notArrived: number;
    cancelled: number;
    confirmed: number;
    pendingFollowups: number;
  };
  byBranch: Array<{
    id: string;
    name: string;
    activeLeads: number;
    _count: { leads: number; appointments: number; patients: number; invoices: number };
  }>;
  analytics: {
    range: { from: string; to: string };
    trend: TrendPoint[];
    leads: {
      byStatus: Breakdown;
      bySource: Breakdown;
      byScore: Breakdown;
      byPriority: Breakdown;
    };
    patients: { total: number; active: number; byStatus: Breakdown };
    appointments: { byStatus: Breakdown };
    followUps: {
      total: number;
      open: number;
      overdue: number;
      completed: number;
      byStatus: Breakdown;
      byChannel: Breakdown;
      byActivity: Breakdown;
    };
    financial: {
      invoices: number;
      billed: number;
      collected: number;
      outstanding: number;
      collectionRate: number;
      byStatus: Breakdown;
      byMode: Breakdown;
    };
  };
};

type AnalyticsTab = 'EXECUTIVE' | 'LEADS' | 'PATIENTS' | 'FOLLOW_UPS' | 'FINANCIAL' | 'BRANCHES';

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function initialRange(days = 30) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  return { from: dateKey(start), to: dateKey(end) };
}

function money(value: number, compact = false) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
    notation: compact ? 'compact' : 'standard',
  }).format(value);
}

function friendly(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function AnalyticsView() {
  const { session, selectedBranchId } = useSessionStore();
  const isAdmin = session?.user.role === 'ADMIN';
  const defaultRange = useMemo(() => initialRange(), []);
  const [branchId, setBranchId] = useState(selectedBranchId ?? '');
  const [dateFrom, setDateFrom] = useState(defaultRange.from);
  const [dateTo, setDateTo] = useState(defaultRange.to);
  const [tab, setTab] = useState<AnalyticsTab>('EXECUTIVE');

  useEffect(() => {
    if (!isAdmin && selectedBranchId) setBranchId(selectedBranchId);
  }, [isAdmin, selectedBranchId]);

  const branchesQuery = useQuery({
    queryKey: ['branches'],
    queryFn: () => apiRequest<{ data: Branch[] }>('/branches'),
  });
  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (branchId) params.set('branchId', branchId);
    if (dateFrom) params.set('dateFrom', new Date(`${dateFrom}T00:00:00+05:30`).toISOString());
    if (dateTo) params.set('dateTo', new Date(`${dateTo}T23:59:59+05:30`).toISOString());
    return params.toString();
  }, [branchId, dateFrom, dateTo]);
  const analyticsQuery = useQuery({
    queryKey: ['analytics-command-centre', queryString],
    queryFn: () =>
      apiRequest<{ data: AnalyticsOverview }>(`/analytics${queryString ? `?${queryString}` : ''}`),
    enabled: Boolean(isAdmin || branchId),
  });

  const overview = analyticsQuery.data?.data;
  const analytics = overview?.analytics;
  const trend =
    analytics?.trend.map((point) => ({
      ...point,
      label: new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(
        new Date(`${point.date}T12:00:00`),
      ),
    })) ?? [];

  function quickRange(range: '7D' | '30D' | '90D' | 'MONTH' | 'ALL') {
    if (range === 'ALL') {
      setDateFrom('');
      setDateTo('');
      return;
    }
    const end = new Date();
    const start = new Date();
    if (range === '7D') start.setDate(end.getDate() - 6);
    if (range === '30D') start.setDate(end.getDate() - 29);
    if (range === '90D') start.setDate(end.getDate() - 89);
    if (range === 'MONTH') start.setDate(1);
    setDateFrom(dateKey(start));
    setDateTo(dateKey(end));
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Business intelligence
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Clinic Analytics Command Centre</h1>
          <p className="text-sm text-muted-foreground">
            Leads, patients, appointments, follow-ups, branches, and financial performance in one
            decision-ready dashboard.
          </p>
        </div>
        <div className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground">
          {analyticsQuery.isFetching ? 'Refreshing data…' : 'Live from clinic records'}
        </div>
      </div>

      <Card className="p-4">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(['7D', '30D', '90D', 'MONTH', 'ALL'] as const).map((range) => (
              <Button
                key={range}
                type="button"
                variant="secondary"
                onClick={() => quickRange(range)}
              >
                {range === 'MONTH'
                  ? 'This month'
                  : range === 'ALL'
                    ? 'All time'
                    : `Last ${range.replace('D', '')} days`}
              </Button>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-[minmax(170px,1fr)_minmax(170px,1fr)_minmax(190px,1fr)_auto] md:items-end">
            <FilterField label="From">
              <Input
                aria-label="Date from"
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
              />
            </FilterField>
            <FilterField label="To">
              <Input
                aria-label="Date to"
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
              />
            </FilterField>
            <FilterField label="Branch">
              <Select
                aria-label="Branch"
                value={branchId}
                disabled={!isAdmin}
                onChange={(event) => setBranchId(event.target.value)}
              >
                {isAdmin ? <option value="">All branches</option> : null}
                {branchesQuery.data?.data.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </Select>
            </FilterField>
            <Button
              type="button"
              variant="secondary"
              onClick={() => analyticsQuery.refetch()}
              disabled={analyticsQuery.isFetching}
            >
              <RefreshCcw className={`size-4 ${analyticsQuery.isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </Card>

      <SegmentedTabs
        tabs={[
          { label: 'Executive', value: 'EXECUTIVE' },
          { label: 'Leads', value: 'LEADS' },
          { label: 'Patients', value: 'PATIENTS' },
          { label: 'Follow-ups', value: 'FOLLOW_UPS' },
          { label: 'Financial', value: 'FINANCIAL' },
          { label: 'Branches', value: 'BRANCHES' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {!isAdmin && !branchId ? (
        <Card className="text-center text-sm text-muted-foreground">
          Select your branch from the header to view analytics.
        </Card>
      ) : analyticsQuery.isLoading ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Preparing clinic analytics…
        </Card>
      ) : analyticsQuery.isError ? (
        <Card className="border-red-200 bg-red-50 p-6 text-red-700">
          {analyticsQuery.error.message}
        </Card>
      ) : (
        <>
          {tab === 'EXECUTIVE' ? <ExecutiveTab overview={overview} trend={trend} /> : null}
          {tab === 'LEADS' ? <LeadsTab overview={overview} trend={trend} /> : null}
          {tab === 'PATIENTS' ? <PatientsTab overview={overview} trend={trend} /> : null}
          {tab === 'FOLLOW_UPS' ? <FollowUpsTab overview={overview} trend={trend} /> : null}
          {tab === 'FINANCIAL' ? <FinancialTab overview={overview} trend={trend} /> : null}
          {tab === 'BRANCHES' ? <BranchesTab overview={overview} /> : null}
        </>
      )}
    </section>
  );
}

function ExecutiveTab({
  overview,
  trend,
}: {
  overview?: AnalyticsOverview;
  trend: Array<TrendPoint & { label: string }>;
}) {
  const totals = overview?.totals;
  const financial = overview?.analytics.financial;
  const followUps = overview?.analytics.followUps;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Lead intake"
          value={totals?.totalLeadIntake ?? 0}
          note={`${totals?.leadConversion ?? 0}% converted`}
          icon={Users}
        />
        <Metric
          label="New patients"
          value={totals?.patients ?? 0}
          note={`${overview?.analytics.patients.active ?? 0} active`}
          icon={UserRoundCheck}
        />
        <Metric
          label="Appointments"
          value={totals?.appointments ?? 0}
          note={`${totals?.arrived ?? 0} arrived`}
          icon={CalendarDays}
        />
        <Metric
          label="Collections"
          value={money(financial?.collected ?? 0)}
          note={`${financial?.collectionRate ?? 0}% collection rate`}
          icon={IndianRupee}
        />
        <Metric
          label="Converted leads"
          value={totals?.convertedLeads ?? 0}
          note="Enquiry to patient"
          icon={TrendingUp}
        />
        <Metric
          label="Open follow-ups"
          value={followUps?.open ?? 0}
          note={`${followUps?.overdue ?? 0} overdue`}
          icon={Clock3}
        />
        <Metric
          label="Billed"
          value={money(financial?.billed ?? 0)}
          note={`${financial?.invoices ?? 0} invoices`}
          icon={CircleDollarSign}
        />
        <Metric
          label="Outstanding"
          value={money(financial?.outstanding ?? 0)}
          note="Pending collection"
          icon={Banknote}
        />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <ChartCard
          title="Clinic growth trend"
          subtitle="Daily acquisition and appointment activity"
        >
          <LineChart
            data={trend}
            series={[
              { key: 'leads', label: 'Leads', color: '#6366f1' },
              { key: 'patients', label: 'Patients', color: '#14b8a6' },
              { key: 'appointments', label: 'Appointments', color: '#e73748' },
            ]}
          />
        </ChartCard>
        <ChartCard
          title="Appointment outcomes"
          subtitle="Operational outcomes in the selected period"
        >
          <DonutChart
            centerLabel="appointments"
            centerValue={totals?.appointments ?? 0}
            data={
              overview?.analytics.appointments.byStatus.map((item, index) => ({
                label: friendly(item.name),
                value: item.count,
                color: ['#6366f1', '#14b8a6', '#f59e0b', '#e73748', '#0ea5e9'][index % 5],
              })) ?? []
            }
          />
        </ChartCard>
      </div>
      <ChartCard
        title="Revenue and collections trend"
        subtitle="Billing raised compared with money collected"
      >
        <LineChart
          data={trend}
          series={[
            { key: 'billed', label: 'Billed', color: '#6366f1' },
            { key: 'collected', label: 'Collected', color: '#14b8a6' },
          ]}
          valueFormatter={(value) => money(value, true)}
        />
      </ChartCard>
    </>
  );
}

function LeadsTab({
  overview,
  trend,
}: {
  overview?: AnalyticsOverview;
  trend: Array<TrendPoint & { label: string }>;
}) {
  const data = overview?.analytics.leads;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="All enquiries" value={overview?.totals.totalLeadIntake ?? 0} icon={Users} />
        <Metric
          label="Converted"
          value={overview?.totals.convertedLeads ?? 0}
          icon={UserRoundCheck}
        />
        <Metric
          label="Conversion rate"
          value={`${overview?.totals.leadConversion ?? 0}%`}
          icon={TrendingUp}
        />
        <Metric
          label="Hot leads"
          value={data?.byScore.find((item) => item.name === 'HOT')?.count ?? 0}
          icon={Activity}
        />
      </div>
      <ChartCard title="Lead acquisition trend" subtitle="New enquiries received each day">
        <LineChart data={trend} series={[{ key: 'leads', label: 'New leads', color: '#6366f1' }]} />
      </ChartCard>
      <div className="grid gap-5 xl:grid-cols-2">
        <BreakdownCard title="Lead funnel by stage" data={data?.byStatus ?? []} />
        <ChartCard title="Lead source mix" subtitle="Where enquiries originated">
          <DonutChart
            centerLabel="leads"
            centerValue={overview?.totals.totalLeadIntake ?? 0}
            data={(data?.bySource ?? []).map((item) => ({
              label: friendly(item.name),
              value: item.count,
            }))}
          />
        </ChartCard>
        <BreakdownCard title="Score quality" data={data?.byScore ?? []} />
        <BreakdownCard title="Priority distribution" data={data?.byPriority ?? []} />
      </div>
    </>
  );
}

function PatientsTab({
  overview,
  trend,
}: {
  overview?: AnalyticsOverview;
  trend: Array<TrendPoint & { label: string }>;
}) {
  const patients = overview?.analytics.patients;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="New patients" value={patients?.total ?? 0} icon={UserRoundCheck} />
        <Metric label="Active patients" value={patients?.active ?? 0} icon={Activity} />
        <Metric
          label="Lead-to-patient conversion"
          value={`${overview?.totals.leadConversion ?? 0}%`}
          icon={TrendingUp}
        />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        <ChartCard title="Patient acquisition trend" subtitle="Patients registered each day">
          <LineChart
            data={trend}
            series={[{ key: 'patients', label: 'New patients', color: '#14b8a6' }]}
          />
        </ChartCard>
        <ChartCard title="Patient status mix" subtitle="Current patient lifecycle">
          <DonutChart
            centerLabel="patients"
            centerValue={patients?.total ?? 0}
            data={(patients?.byStatus ?? []).map((item) => ({
              label: friendly(item.name),
              value: item.count,
            }))}
          />
        </ChartCard>
      </div>
      <BreakdownCard
        title="Patients by branch"
        data={
          overview?.byBranch.map((branch) => ({
            name: branch.name,
            count: branch._count.patients,
          })) ?? []
        }
      />
    </>
  );
}

function FollowUpsTab({
  overview,
  trend,
}: {
  overview?: AnalyticsOverview;
  trend: Array<TrendPoint & { label: string }>;
}) {
  const data = overview?.analytics.followUps;
  const completionRate = data?.total
    ? Math.round(((data.completed ?? 0) / data.total) * 1000) / 10
    : 0;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Total follow-ups" value={data?.total ?? 0} icon={Clock3} />
        <Metric label="Open" value={data?.open ?? 0} icon={Activity} />
        <Metric label="Overdue" value={data?.overdue ?? 0} icon={CalendarCheck} />
        <Metric label="Completion rate" value={`${completionRate}%`} icon={TrendingUp} />
      </div>
      <ChartCard
        title="Follow-up workload trend"
        subtitle="Calls, messages, and next actions due each day"
      >
        <LineChart
          data={trend}
          series={[{ key: 'followUps', label: 'Follow-ups due', color: '#f59e0b' }]}
        />
      </ChartCard>
      <div className="grid gap-5 xl:grid-cols-3">
        <ChartCard title="Status mix" subtitle="Open versus completed workload">
          <DonutChart
            centerLabel="follow-ups"
            centerValue={data?.total ?? 0}
            data={(data?.byStatus ?? []).map((item) => ({
              label: friendly(item.name),
              value: item.count,
            }))}
          />
        </ChartCard>
        <BreakdownCard title="Communication channels" data={data?.byChannel ?? []} />
        <BreakdownCard title="Activity types" data={data?.byActivity ?? []} />
      </div>
    </>
  );
}

function FinancialTab({
  overview,
  trend,
}: {
  overview?: AnalyticsOverview;
  trend: Array<TrendPoint & { label: string }>;
}) {
  const data = overview?.analytics.financial;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Invoices" value={data?.invoices ?? 0} icon={CircleDollarSign} />
        <Metric label="Billed" value={money(data?.billed ?? 0)} icon={IndianRupee} />
        <Metric label="Collected" value={money(data?.collected ?? 0)} icon={Banknote} />
        <Metric label="Outstanding" value={money(data?.outstanding ?? 0)} icon={Activity} />
        <Metric label="Collection rate" value={`${data?.collectionRate ?? 0}%`} icon={TrendingUp} />
      </div>
      <ChartCard
        title="Financial performance trend"
        subtitle="Daily billed amount versus actual collections"
      >
        <LineChart
          data={trend}
          series={[
            { key: 'billed', label: 'Billed', color: '#6366f1' },
            { key: 'collected', label: 'Collected', color: '#14b8a6' },
          ]}
          valueFormatter={(value) => money(value, true)}
        />
      </ChartCard>
      <div className="grid gap-5 xl:grid-cols-2">
        <ChartCard
          title="Invoice value by status"
          subtitle="Value of invoices in each collection stage"
        >
          <HorizontalBarChart
            valueSuffix=""
            data={(data?.byStatus ?? []).map((item) => ({
              label: friendly(item.name),
              value: item.amount ?? 0,
            }))}
          />
          <p className="mt-3 text-xs text-muted-foreground">Values shown in Indian rupees.</p>
        </ChartCard>
        <ChartCard title="Collection method mix" subtitle="Completed payments by payment mode">
          <DonutChart
            centerLabel="collected"
            centerValue={money(data?.collected ?? 0, true)}
            data={(data?.byMode ?? []).map((item) => ({
              label: friendly(item.name),
              value: item.amount ?? 0,
            }))}
          />
        </ChartCard>
      </div>
    </>
  );
}

function BranchesTab({ overview }: { overview?: AnalyticsOverview }) {
  const branches = overview?.byBranch ?? [];
  return (
    <>
      <div className="grid gap-5 xl:grid-cols-2">
        <ChartCard
          title="Lead and appointment throughput"
          subtitle="Cross-branch volume comparison"
        >
          <ColumnChart
            data={branches.map((branch) => ({
              label: branch.name,
              value: branch._count.appointments,
              secondaryValue: branch._count.leads,
            }))}
          />
          <p className="mt-3 text-xs text-muted-foreground">
            Solid bars: appointments · Light bars: leads
          </p>
        </ChartCard>
        <ChartCard
          title="Patient base by branch"
          subtitle="Registered patients versus active leads"
        >
          <HorizontalBarChart
            data={branches.map((branch) => ({
              label: branch.name,
              value: branch._count.patients,
              secondaryValue: branch.activeLeads,
            }))}
          />
          <p className="mt-3 text-xs text-muted-foreground">
            Solid bars: patients · Light bars: active leads
          </p>
        </ChartCard>
      </div>
      <Card className="overflow-hidden p-0">
        <div className="border-b px-4 py-3">
          <h2 className="font-semibold">Branch performance table</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Leads</th>
                <th className="px-4 py-3">Active leads</th>
                <th className="px-4 py-3">Patients</th>
                <th className="px-4 py-3">Appointments</th>
                <th className="px-4 py-3">Invoices</th>
              </tr>
            </thead>
            <tbody>
              {branches.map((branch) => (
                <tr key={branch.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{branch.name}</td>
                  <td className="px-4 py-3">{branch._count.leads}</td>
                  <td className="px-4 py-3">{branch.activeLeads}</td>
                  <td className="px-4 py-3">{branch._count.patients}</td>
                  <td className="px-4 py-3">{branch._count.appointments}</td>
                  <td className="px-4 py-3">{branch._count.invoices}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function Metric({
  label,
  value,
  note,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  note?: string;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="mt-2 truncate text-2xl font-semibold">{value}</div>
          {note ? <div className="mt-1 text-xs text-muted-foreground">{note}</div> : null}
        </div>
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Icon className="size-5" />
        </div>
      </div>
    </Card>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <div className="mb-5">
        <h2 className="font-semibold">{title}</h2>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {children}
    </Card>
  );
}

function BreakdownCard({ title, data }: { title: string; data: Breakdown }) {
  return (
    <ChartCard title={title}>
      {data.length ? (
        <HorizontalBarChart
          data={data.map((item) => ({ label: friendly(item.name), value: item.count }))}
        />
      ) : (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No data in this period.
        </div>
      )}
    </ChartCard>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
