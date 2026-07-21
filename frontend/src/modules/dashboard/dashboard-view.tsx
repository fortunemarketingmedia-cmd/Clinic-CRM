'use client';

import { useQuery } from '@tanstack/react-query';
import { Activity, ArrowUpRight, CalendarDays, IndianRupee, PhoneCall, Plus, Search, TrendingUp, UserRoundCheck, Users } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { ColumnChart, DonutChart, HorizontalBarChart, SegmentedTabs } from '@/components/ui/data-visuals';
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
  byBranch: Array<{ id: string; name: string; activeLeads: number; _count: { leads: number; appointments: number; patients: number; invoices: number } }>;
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
  dailyWork?: {
    todaysFollowups: Array<{ id: string; name: string; mobile: string; nextFollowupAt?: string | null }>;
    missedFollowups: Array<{ id: string; name: string; mobile: string; nextFollowupAt?: string | null }>;
    newLeadsNotContacted: Array<{ id: string; name: string; mobile: string }>;
    postponedAppointments: Array<{ id: string; appointmentAt: string; lead: { name: string; mobile: string } }>;
    notArrivedPatients: Array<{ id: string; appointmentAt: string; lead: { name: string; mobile: string } }>;
    pendingPaymentInvoices: Array<{ id: string; invoiceNo: string; totalAmount: string | number; paidAmount: string | number; patient: { fullName: string; mobile: string } }>;
  };
};

function money(value?: string | number) {
  return `Rs ${Number(value ?? 0).toLocaleString('en-IN')}`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function DashboardView() {
  const { session } = useSessionStore();
  const isAdmin = session?.user.role === 'ADMIN';
  const [dashboardTab, setDashboardTab] = useState<'PERFORMANCE' | 'OPERATIONS'>('PERFORMANCE');

  const dashboardQuery = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: () => apiRequest<{ data: DashboardOverview }>('/analytics'),
  });

  const totals = dashboardQuery.data?.data.totals;
  const dailyWork = dashboardQuery.data?.data.dailyWork;
  const metrics = isAdmin
    ? [
        { label: 'Patients', value: totals?.patients ?? 0, icon: UserRoundCheck },
        { label: 'Total Leads', value: totals?.leads ?? 0, icon: Users },
        { label: "Today's Revenue", value: money(totals?.todayRevenue), icon: IndianRupee },
        { label: 'Monthly Revenue', value: money(totals?.monthlyRevenue), icon: TrendingUp },
      ]
    : [
        { label: "Today's Appointments", value: totals?.todayAppointments ?? 0, icon: CalendarDays },
        { label: 'Waiting Patients', value: totals?.confirmed ?? 0, icon: UserRoundCheck },
        { label: 'New Leads', value: totals?.leads ?? 0, icon: Users },
        { label: "Today's Follow-ups", value: totals?.pendingFollowups ?? 0, icon: PhoneCall },
      ];

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{isAdmin ? 'Owner Dashboard' : 'Reception Dashboard'}</h1>
        <p className="text-sm text-muted-foreground">
          {isAdmin ? 'Main clinic performance, appointments, patients, and revenue.' : 'Today and upcoming work for front desk operations.'}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedTabs tabs={[{ label: 'Performance', value: 'PERFORMANCE' }, { label: 'Today’s operations', value: 'OPERATIONS', count: (dailyWork?.todaysFollowups.length ?? 0) + (dailyWork?.notArrivedPatients.length ?? 0) }]} value={dashboardTab} onChange={setDashboardTab} />
        <Link href="/analytics" className="flex items-center gap-1 px-2 text-sm font-medium text-primary">Open detailed analytics <ArrowUpRight className="size-4" /></Link>
      </div>

      {dashboardTab === 'PERFORMANCE' ? (
        <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <Card>
            <div className="mb-5 flex items-start justify-between gap-3">
              <div><h2 className="font-semibold">Branch performance</h2><p className="text-sm text-muted-foreground">Appointments compared with total enquiries</p></div>
              <Activity className="size-5 text-primary" />
            </div>
            <ColumnChart data={(dashboardQuery.data?.data.byBranch ?? []).map((branch) => ({ label: branch.name, value: branch._count.appointments, secondaryValue: branch._count.leads }))} />
            <div className="mt-4 flex gap-4 text-xs text-muted-foreground"><span className="flex items-center gap-2"><i className="size-2.5 rounded-full bg-primary" />Appointments</span><span className="flex items-center gap-2"><i className="size-2.5 rounded-full bg-primary/25" />Enquiries</span></div>
          </Card>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1">
            <Card>
              <div className="mb-4"><h2 className="font-semibold">Appointment outcome</h2><p className="text-sm text-muted-foreground">Current service flow at a glance</p></div>
              <DonutChart centerLabel="appointments" centerValue={totals?.appointments ?? 0} data={[{ label: 'Confirmed', value: totals?.confirmed ?? 0, color: '#6366f1' }, { label: 'Arrived', value: totals?.arrived ?? 0, color: '#14b8a6' }, { label: 'Not arrived', value: totals?.notArrived ?? 0, color: '#e73748' }]} />
            </Card>
            <Card>
              <div className="mb-4"><h2 className="font-semibold">Lead funnel</h2><p className="text-sm text-muted-foreground">From enquiry to patient conversion</p></div>
              <HorizontalBarChart data={[{ label: 'Lead intake', value: totals?.totalLeadIntake ?? totals?.leads ?? 0, color: '#6366f1' }, { label: 'Appointments', value: totals?.appointments ?? 0, color: '#f59e0b' }, { label: 'Arrived', value: totals?.arrived ?? 0, color: '#14b8a6' }, { label: 'Converted', value: totals?.convertedLeads ?? 0, color: '#e73748' }]} />
            </Card>
          </div>
        </div>
      ) : (

      <div className="grid gap-5 lg:grid-cols-3">
        {isAdmin ? (
          <>
            <WorkQueue title="Pending payment reminders" rows={dailyWork?.pendingPaymentInvoices.map((invoice) => `${invoice.patient.fullName} · ${money(Number(invoice.totalAmount) - Number(invoice.paidAmount))} pending`) ?? []} />
            <WorkQueue title="Campaign follow-ups today" rows={dailyWork?.todaysFollowups.map((lead) => `${lead.name} · ${lead.mobile}`) ?? []} />
            <WorkQueue title="Not arrived patients" rows={dailyWork?.notArrivedPatients.map((appointment) => `${appointment.lead.name} · ${formatDateTime(appointment.appointmentAt)}`) ?? []} />
          </>
        ) : (
          <>
            <WorkQueue title="Today's follow-ups" rows={dailyWork?.todaysFollowups.map((lead) => `${lead.name} · ${lead.mobile}`) ?? []} />
            <WorkQueue title="Missed follow-ups" rows={dailyWork?.missedFollowups.map((lead) => `${lead.name} · ${lead.mobile}`) ?? []} />
            <WorkQueue title="New leads not contacted" rows={dailyWork?.newLeadsNotContacted.map((lead) => `${lead.name} · ${lead.mobile}`) ?? []} />
          </>
        )}
      </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">{isAdmin ? 'Appointment Records' : 'Upcoming Appointments'}</h2>
            <a className="text-sm text-primary" href="/appointments">
              Open calendar
            </a>
          </div>
          <div className="mt-4 overflow-hidden rounded-md border border-border">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">When</th>
                  <th className="px-4 py-3 font-medium">Patient</th>
                  <th className="px-4 py-3 font-medium">Branch</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {dashboardQuery.data?.data.upcomingAppointments.map((appointment) => (
                  <tr key={appointment.id} className="border-t border-border">
                    <td className="px-4 py-3 text-muted-foreground">{formatDateTime(appointment.appointmentAt)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{appointment.lead.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {appointment.lead.mobile} · {appointment.lead.source.replace('_', ' ')}
                      </div>
                    </td>
                    <td className="px-4 py-3">{appointment.branch.name}</td>
                    <td className="px-4 py-3"><div>{appointment.status.replace('_', ' ')}</div><div className="text-xs text-muted-foreground">{appointment.resourceType === 'TREATMENT_ROOM' ? `Room ${appointment.roomNumber}` : 'Consultation'}</div></td>
                  </tr>
                ))}
                {!dashboardQuery.isLoading && dashboardQuery.data?.data.upcomingAppointments.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-muted-foreground" colSpan={4}>
                      No upcoming appointments.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <h2 className="text-base font-semibold">{isAdmin ? 'Branch Comparison' : 'Quick Actions'}</h2>
          <div className="mt-4 grid gap-3">
            {isAdmin ? (
              dashboardQuery.data?.data.byBranch.map((branch) => (
                <div key={branch.id} className="rounded-md border border-border px-3 py-2 text-sm">
                  <div className="font-medium">{branch.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {branch.activeLeads} active leads · {branch._count.patients} patients · {branch._count.appointments} appointments
                  </div>
                </div>
              ))
            ) : (
              <>
                <Link className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted" href="/leads">
                  <Plus className="size-4 text-primary" />
                  Quick Add Lead
                </Link>
                <Link className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted" href="/appointments">
                  <CalendarDays className="size-4 text-primary" />
                  Quick Book Appointment
                </Link>
                <Link className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted" href="/patients">
                  <Search className="size-4 text-primary" />
                  Quick Search
                </Link>
              </>
            )}
          </div>
          {isAdmin ? (
            <div className="mt-6">
              <h3 className="text-sm font-semibold">Business Snapshot</h3>
              <div className="mt-3 space-y-2">
                <SnapshotRow label="Lead Conversion" value={`${totals?.leadConversion ?? 0}%`} />
                <SnapshotRow label="Total Revenue" value={money(totals?.revenue)} />
                <SnapshotRow label="Collected" value={money(totals?.collected)} />
              </div>
            </div>
          ) : null}
        </Card>
      </div>
    </section>
  );
}

function SnapshotRow({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function WorkQueue({ title, rows }: { title: string; rows: string[] }) {
  return (
    <Card>
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="mt-3 space-y-2">
        {rows.length ? (
          rows.slice(0, 5).map((row) => (
            <div key={row} className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">
              {row}
            </div>
          ))
        ) : (
          <div className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
            Nothing pending.
          </div>
        )}
      </div>
    </Card>
  );
}
