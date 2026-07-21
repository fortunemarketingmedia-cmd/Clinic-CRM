'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, CalendarPlus, Edit3, Link2, Megaphone, PhoneCall, Plus, Search, Target, TrendingUp, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { apiRequest } from '@/services/api';
import { useSessionStore } from '@/store/session-store';
import type { AdLead, AdPlatform } from '@/types/ad-lead';
import type { Branch } from '@/types/branch';
import type { Lead, LeadStatus, TimelineEvent } from '@/types/lead';

const leadStatuses: Array<{ label: string; value: LeadStatus }> = [
  { label: 'New', value: 'NEW' },
  { label: 'Confirmed', value: 'CONFIRMED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

const leadSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  mobile: z.string().min(8, 'Mobile number is required'),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  source: z.enum(['WEBSITE', 'WALK_IN', 'PHONE_CALL', 'WHATSAPP', 'GOOGLE_ADS', 'META_ADS']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  nextFollowupAt: z.string().optional(),
  lastContactedAt: z.string().optional(),
  followupNotes: z.string().optional(),
  interestedTreatment: z.string().optional(),
  branchId: z.string().min(1, 'Branch is required'),
});

const appointmentBookingSchema = z.object({
  branchId: z.string().min(1, 'Branch is required'),
  appointmentType: z.enum(['CLINIC_VISIT', 'VIDEO_CONSULTATION']),
  resourceType: z.enum(['CONSULTATION', 'TREATMENT_ROOM']),
  roomNumber: z.coerce.number().int().min(1).max(4).optional(),
  appointmentAt: z.string().min(1, 'Appointment time is required'),
  notes: z.string().optional(),
}).refine((value) => value.resourceType !== 'TREATMENT_ROOM' || Boolean(value.roomNumber), { message: 'Select a treatment room', path: ['roomNumber'] });

type LeadFormValues = z.infer<typeof leadSchema>;
type AppointmentBookingValues = z.infer<typeof appointmentBookingSchema>;
type LeadSource = Lead['source'];
type LeadTab = 'ALL' | 'MANUAL' | 'GOOGLE_ADS' | 'META_ADS' | 'CAMPAIGN_ANALYTICS';

type AdLeadResponse = {
  leads: AdLead[];
  stats: Array<{ platform: AdPlatform; _count: { id: number } }>;
};

function sourceLabel(source: Lead['source']) {
  return source.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function percent(value: number, total: number) {
  if (!total) {
    return 0;
  }

  return Math.round((value / total) * 100);
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function LeadsView() {
  const queryClient = useQueryClient();
  const { session, selectedBranchId, setSelectedBranchId, hasHydrated } = useSessionStore();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<LeadStatus | ''>('');
  const [source, setSource] = useState<LeadSource | ''>('');
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [bookingLead, setBookingLead] = useState<Lead | null>(null);
  const [activeTab, setActiveTab] = useState<LeadTab>('ALL');
  const [showLeadForm, setShowLeadForm] = useState(false);

  const isAdmin = session?.user.role === 'ADMIN';

  const branchesQuery = useQuery({
    queryKey: ['branches'],
    queryFn: () => apiRequest<{ data: Branch[] }>('/branches'),
    enabled: hasHydrated && Boolean(session),
  });

  const branches = useMemo(() => branchesQuery.data?.data ?? [], [branchesQuery.data]);

  useEffect(() => {
    if (!hasHydrated || branches.length === 0) {
      return;
    }

    if (isAdmin && selectedBranchId === null) {
      setSelectedBranchId('');
      return;
    }

    if (!isAdmin && (!selectedBranchId || !branches.some((branch) => branch.id === selectedBranchId))) {
      setSelectedBranchId(branches[0].id);
      return;
    }

    if (selectedBranchId && !branches.some((branch) => branch.id === selectedBranchId)) {
      setSelectedBranchId(isAdmin ? '' : branches[0].id);
    }
  }, [branches, hasHydrated, isAdmin, selectedBranchId, setSelectedBranchId]);

  const activeBranchId = selectedBranchId ?? (isAdmin ? '' : branches[0]?.id ?? '');
  const formBranchId = activeBranchId || branches[0]?.id || '';

  const queryString = useMemo(() => {
    const params = new URLSearchParams();

    if (!isAdmin || activeBranchId) {
      params.set('branchId', activeBranchId);
    }

    if (status) {
      params.set('status', status);
    }

    if (source) {
      params.set('source', source);
    } else if (activeTab === 'GOOGLE_ADS' || activeTab === 'META_ADS') {
      params.set('source', activeTab);
    }

    if (search.trim()) {
      params.set('search', search.trim());
    }

    return params.toString();
  }, [activeBranchId, activeTab, isAdmin, search, source, status]);

  const leadsQuery = useQuery({
    queryKey: ['leads', queryString],
    queryFn: () => apiRequest<{ data: Lead[] }>(`/leads?${queryString}`),
    enabled: hasHydrated && Boolean(session) && Boolean(isAdmin || activeBranchId),
  });

  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      name: '',
      mobile: '',
      email: '',
      address: '',
      source: 'PHONE_CALL',
      priority: 'MEDIUM',
      nextFollowupAt: '',
      lastContactedAt: '',
      followupNotes: '',
      interestedTreatment: '',
      branchId: formBranchId,
    },
  });

  const bookingForm = useForm<AppointmentBookingValues>({
    resolver: zodResolver(appointmentBookingSchema),
    defaultValues: {
      branchId: formBranchId,
      appointmentType: 'CLINIC_VISIT',
      resourceType: 'CONSULTATION',
      roomNumber: undefined,
      appointmentAt: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (!editingLead && formBranchId) {
      form.setValue('branchId', formBranchId);
    }
    if (!bookingLead && formBranchId) {
      bookingForm.setValue('branchId', formBranchId);
    }
  }, [bookingForm, bookingLead, editingLead, form, formBranchId]);

  const adLeadsQuery = useQuery({
    queryKey: ['ad-leads-summary', activeBranchId],
    queryFn: () => apiRequest<{ data: AdLeadResponse }>(`/ad-leads${activeBranchId ? `?branchId=${activeBranchId}` : ''}`),
    enabled: hasHydrated && Boolean(session) && isAdmin,
  });

  const duplicateQuery = useQuery({
    queryKey: ['lead-duplicates', form.watch('mobile'), form.watch('email')],
    queryFn: () => {
      const params = new URLSearchParams();
      const mobile = form.getValues('mobile').trim();
      const email = form.getValues('email')?.trim();
      if (mobile) params.set('mobile', mobile);
      if (email) params.set('email', email);
      return apiRequest<{ data: { leads: Lead[]; patients: Array<{ id: string; patientNo: string; fullName: string; mobile: string }> } }>(
        `/leads/duplicates/search?${params.toString()}`,
      );
    },
    enabled: !editingLead && (form.watch('mobile').trim().length >= 8 || Boolean(form.watch('email')?.trim())),
  });

  const selectedLeadTimelineQuery = useQuery({
    queryKey: ['lead-timeline', selectedLead?.id],
    queryFn: () => apiRequest<{ data: TimelineEvent[] }>(`/leads/${selectedLead?.id}/timeline`),
    enabled: Boolean(selectedLead?.id),
  });

  const createLead = useMutation({
    mutationFn: (values: LeadFormValues) =>
      apiRequest<{ data: Lead }>('/leads', {
        method: 'POST',
        body: JSON.stringify({
          ...values,
          email: values.email || undefined,
          address: values.address || undefined,
          nextFollowupAt: values.nextFollowupAt || undefined,
          lastContactedAt: values.lastContactedAt || undefined,
          followupNotes: values.followupNotes || undefined,
          interestedTreatment: values.interestedTreatment || undefined,
        }),
      }),
    onSuccess: () => {
      form.reset({
        name: '',
        mobile: '',
        email: '',
        address: '',
        source: 'PHONE_CALL',
        priority: 'MEDIUM',
        nextFollowupAt: '',
        lastContactedAt: '',
        followupNotes: '',
        interestedTreatment: '',
        branchId: formBranchId,
      });

      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      setShowLeadForm(false);
    },
  });

  const updateLead = useMutation({
    mutationFn: ({ id, values }: { id: string; values: Partial<LeadFormValues> & { status?: LeadStatus } }) =>
      apiRequest<{ data: Lead }>(`/leads/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...values,
          email: values.email || undefined,
          nextFollowupAt: values.nextFollowupAt || undefined,
          lastContactedAt: values.lastContactedAt || undefined,
          followupNotes: values.followupNotes || undefined,
          interestedTreatment: values.interestedTreatment || undefined,
        }),
      }),
    onSuccess: () => {
      setEditingLead(null);
      setShowLeadForm(false);
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });

  const bookAppointment = useMutation({
    mutationFn: ({ lead, values }: { lead: Lead; values: AppointmentBookingValues }) =>
      apiRequest('/appointments', {
        method: 'POST',
        body: JSON.stringify({
          leadId: lead.id,
          branchId: values.branchId,
          appointmentAt: values.appointmentAt,
          appointmentType: values.appointmentType,
          resourceType: values.resourceType,
          roomNumber: values.resourceType === 'TREATMENT_ROOM' ? values.roomNumber : undefined,
          notes: values.notes || undefined,
        }),
      }),
    onSuccess: () => {
      setBookingLead(null);
      bookingForm.reset({
        branchId: formBranchId,
        appointmentType: 'CLINIC_VISIT',
        resourceType: 'CONSULTATION',
        roomNumber: undefined,
        appointmentAt: '',
        notes: '',
      });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
    },
  });

  function startEdit(lead: Lead) {
    setEditingLead(lead);
    setShowLeadForm(true);

    form.reset({
      name: lead.name,
      mobile: lead.mobile,
      email: lead.email ?? '',
      address: lead.address ?? '',
      source: lead.source,
      priority: lead.priority ?? 'MEDIUM',
      nextFollowupAt: toDateTimeLocal(lead.nextFollowupAt),
      lastContactedAt: toDateTimeLocal(lead.lastContactedAt),
      followupNotes: lead.followupNotes ?? '',
      interestedTreatment: lead.interestedTreatment ?? '',
      branchId: lead.branchId,
    });
  }

  function startBooking(lead: Lead) {
    setBookingLead(lead);
    bookingForm.reset({
      branchId: lead.branchId,
      appointmentType: lead.appointmentType ?? 'CLINIC_VISIT',
      resourceType: 'CONSULTATION',
      roomNumber: undefined,
      appointmentAt: '',
      notes: '',
    });
  }

  function resetCreateForm() {
    setEditingLead(null);

    form.reset({
      name: '',
      mobile: '',
      email: '',
      address: '',
      source: 'PHONE_CALL',
      priority: 'MEDIUM',
      nextFollowupAt: '',
      lastContactedAt: '',
      followupNotes: '',
      interestedTreatment: '',
      branchId: formBranchId,
    });
  }

  function onSubmit(values: LeadFormValues) {
    if (editingLead) {
      updateLead.mutate({
        id: editingLead.id,
        values: {
          ...values,
          address: values.address || undefined,
        },
      });

      return;
    }

    createLead.mutate(values);
  }

  const googleCount = adLeadsQuery.data?.data.stats.find((item) => item.platform === 'GOOGLE')?._count.id ?? 0;
  const metaCount = adLeadsQuery.data?.data.stats.find((item) => item.platform === 'META')?._count.id ?? 0;
  const publicBase = typeof window !== 'undefined' ? `${window.location.origin.replace(/:\d+$/, ':4000')}/api/public` : '/api/public';
  const leads = useMemo(() => {
    const rows = leadsQuery.data?.data ?? [];
    return activeTab === 'MANUAL' ? rows.filter((lead) => lead.source !== 'GOOGLE_ADS' && lead.source !== 'META_ADS') : rows;
  }, [activeTab, leadsQuery.data]);
  const adLeads = adLeadsQuery.data?.data.leads ?? [];
  const leadAnalytics = useMemo(() => {
    const sourceCounts = new Map<LeadSource, number>();
    const statusCounts = new Map<LeadStatus, number>();

    for (const lead of leads) {
      sourceCounts.set(lead.source, (sourceCounts.get(lead.source) ?? 0) + 1);
      statusCounts.set(lead.status, (statusCounts.get(lead.status) ?? 0) + 1);
    }

    const sourceRows = Array.from(sourceCounts.entries())
      .map(([label, value]) => ({ label: sourceLabel(label), value }))
      .sort((a, b) => b.value - a.value);
    const statusRows = Array.from(statusCounts.entries())
      .filter(([label]) => !['POSTPONED', 'ARRIVED', 'NOT_ARRIVED'].includes(label))
      .map(([label, value]) => ({ label: label.replaceAll('_', ' '), value }))
      .sort((a, b) => b.value - a.value);
    const campaignCounts = new Map<string, { label: string; platform: AdPlatform; value: number }>();

    for (const adLead of adLeads) {
      const label = adLead.campaignName || adLead.formName || adLead.adName || `${adLead.platform} untagged campaign`;
      const key = `${adLead.platform}:${label}`;
      const row = campaignCounts.get(key) ?? { label, platform: adLead.platform, value: 0 };
      row.value += 1;
      campaignCounts.set(key, row);
    }

    return {
      total: leads.length,
      sourceRows,
      statusRows,
      campaignRows: Array.from(campaignCounts.values()).sort((a, b) => b.value - a.value).slice(0, 5),
      bookedOrConfirmed: leads.filter((lead) => ['BOOKED', 'CONFIRMED', 'ARRIVED', 'CONVERTED'].includes(lead.status)).length,
      adAttributed: leads.filter((lead) => lead.source === 'GOOGLE_ADS' || lead.source === 'META_ADS' || (lead.adLeads?.length ?? 0) > 0).length,
    };
  }, [adLeads, leads]);
  const duplicateMatches = duplicateQuery.data?.data;
  const tabs: Array<{ label: string; value: LeadTab }> = [
    { label: 'All Leads', value: 'ALL' },
    { label: 'Manual Leads', value: 'MANUAL' },
    { label: 'Google Ads', value: 'GOOGLE_ADS' },
    { label: 'Meta Ads', value: 'META_ADS' },
    { label: 'Campaign Analytics', value: 'CAMPAIGN_ANALYTICS' },
  ];
  const journeyStages = [
    { label: 'New enquiry', count: (leadsQuery.data?.data ?? []).filter((lead) => lead.status === 'NEW').length, color: '#6366f1' },
    { label: 'Follow-up due', count: (leadsQuery.data?.data ?? []).filter((lead) => Boolean(lead.nextFollowupAt) && lead.status !== 'CONVERTED').length, color: '#f59e0b' },
    { label: 'Appointment', count: (leadsQuery.data?.data ?? []).filter((lead) => ['BOOKED', 'CONFIRMED'].includes(lead.status)).length, color: '#0ea5e9' },
    { label: 'Converted', count: (leadsQuery.data?.data ?? []).filter((lead) => lead.status === 'CONVERTED').length, color: '#e73748' },
  ];

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Leads</h1>
          <p className="text-sm text-muted-foreground">Every enquiry starts here before becoming a patient.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={() => { resetCreateForm(); setShowLeadForm(true); }}><Plus className="size-4" />Add lead</Button>
        {isAdmin ? (
          <Select
            aria-label="Branch filter"
            className="w-56"
            value={activeBranchId}
            onChange={(event) => setSelectedBranchId(event.target.value)}
          >
            <option value="">All branches</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </Select>
        ) : null}
        </div>
      </div>

      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div><h2 className="font-semibold">Lead journey</h2><p className="text-sm text-muted-foreground">A clear path from first enquiry to converted patient</p></div>
          <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4 lg:max-w-3xl">
            {journeyStages.map((stage, index) => {
              return <div key={stage.label} className="relative rounded-lg border border-border bg-muted/30 p-3"><div className="mb-2 flex items-center justify-between"><i className="size-2.5 rounded-full" style={{ background: stage.color }} /><span className="text-[10px] text-muted-foreground">0{index + 1}</span></div><div className="text-xl font-semibold">{stage.count}</div><div className="text-xs text-muted-foreground">{stage.label}</div></div>;
            })}
          </div>
        </div>
      </Card>

      {isAdmin ? (
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <TrendingUp className="size-5" />
            </div>
            <div>
              <h2 className="font-semibold">Google & Meta Lead Integration</h2>
              <p className="text-sm text-muted-foreground">Connect ad lead forms to these endpoints. Incoming campaign leads will appear automatically in this Leads list.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Endpoint label="Google Ads endpoint" value={`${publicBase}/ads/google`} />
            <Endpoint label="Meta Ads endpoint" value={`${publicBase}/ads/meta`} />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Metric label="Google Ads Leads" value={googleCount} />
            <Metric label="Meta Ads Leads" value={metaCount} />
            <Metric label="Total Campaign Leads" value={googleCount + metaCount} />
          </div>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Button
            key={tab.value}
            type="button"
            variant={activeTab === tab.value ? 'primary' : 'secondary'}
            onClick={() => {
              setActiveTab(tab.value);
              setSource('');
            }}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr_1fr]">
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Target className="size-5" />
            </div>
            <div>
              <h2 className="font-semibold">Lead Performance</h2>
              <p className="text-sm text-muted-foreground">{leadAnalytics.total} leads in the current view</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Metric label="Booked / Confirmed" value={leadAnalytics.bookedOrConfirmed} />
            <Metric label="Ad attributed" value={leadAnalytics.adAttributed} />
          </div>
          <div className="mt-4">
            <ProgressLine label="Appointment readiness" value={leadAnalytics.bookedOrConfirmed} total={leadAnalytics.total} />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Sources</h2>
            <BarChart3 className="size-5 text-primary" />
          </div>
          <AnalyticsBars data={leadAnalytics.sourceRows} total={leadAnalytics.total} />
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Statuses</h2>
            <TrendingUp className="size-5 text-primary" />
          </div>
          <AnalyticsBars data={leadAnalytics.statusRows} total={leadAnalytics.total} />
        </Card>
      </div>

      {(isAdmin || activeTab === 'CAMPAIGN_ANALYTICS') ? (
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Campaign Analytics</h2>
              <p className="text-sm text-muted-foreground">Google and Meta leads grouped by campaign, form, or ad name.</p>
            </div>
            <Megaphone className="size-5 text-primary" />
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-5">
            {leadAnalytics.campaignRows.length ? (
              leadAnalytics.campaignRows.map((campaign) => (
                <div key={`${campaign.platform}-${campaign.label}`} className="rounded-md border border-border p-3">
                  <div className="text-xs font-medium text-muted-foreground">{campaign.platform === 'GOOGLE' ? 'Google Ads' : 'Meta Ads'}</div>
                  <div className="mt-1 min-h-10 text-sm font-semibold">{campaign.label}</div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.max(percent(campaign.value, googleCount + metaCount), campaign.value ? 8 : 0)}%` }}
                    />
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">{campaign.value} leads</div>
                </div>
              ))
            ) : (
              <div className="py-8 text-sm text-muted-foreground lg:col-span-5">Campaign data will appear as soon as Google or Meta starts sending leads.</div>
            )}
          </div>
        </Card>
      ) : null}

      {showLeadForm || editingLead ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/45 p-3 backdrop-blur-[2px] sm:p-6" role="dialog" aria-modal="true" aria-labelledby="lead-form-title" onMouseDown={(event) => { if (event.target === event.currentTarget) { setShowLeadForm(false); resetCreateForm(); } }}>
        <Card className="mx-auto max-w-5xl shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-border pb-4"><div><h2 id="lead-form-title" className="text-xl font-semibold">{editingLead ? 'Edit Lead' : 'Add New Lead'}</h2><p className="mt-1 text-sm text-muted-foreground">{editingLead ? 'Update contact, interest and follow-up information.' : 'Capture a new enquiry and assign the next action.'}</p></div><Button type="button" variant="secondary" className="w-10 shrink-0 px-0" aria-label="Close lead form" onClick={() => { setShowLeadForm(false); resetCreateForm(); }}><X className="size-4" /></Button></div>

          <form className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid gap-3 sm:grid-cols-2 md:col-span-2 xl:col-span-3">
              <label className="block space-y-2">
                <span className="text-sm font-medium">Name</span>
                <Input {...form.register('name')} />
                {form.formState.errors.name ? (
                  <span className="text-xs text-red-600">{form.formState.errors.name.message}</span>
                ) : null}
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium">Mobile</span>
                <Input {...form.register('mobile')} />
                {form.formState.errors.mobile ? (
                  <span className="text-xs text-red-600">{form.formState.errors.mobile.message}</span>
                ) : null}
              </label>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-medium">Email</span>
              <Input type="email" {...form.register('email')} />
            </label>

            {duplicateMatches && (duplicateMatches.leads.length || duplicateMatches.patients.length) ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 md:col-span-2 xl:col-span-3">
                <div className="font-semibold">Existing record found</div>
                <div className="mt-2 space-y-1">
                  {duplicateMatches.patients.map((patient) => (
                    <div key={patient.id}>
                      Patient: {patient.fullName} · {patient.mobile} · {patient.patientNo}
                    </div>
                  ))}
                  {duplicateMatches.leads.map((lead) => (
                    <button key={lead.id} type="button" className="block text-left underline" onClick={() => setSelectedLead(lead)}>
                      View existing lead: {lead.name} · {lead.mobile} · {lead.status.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <label className="block space-y-2 md:col-span-2 xl:col-span-1">
              <span className="text-sm font-medium">Address</span>
              <Input {...form.register('address')} />
            </label>

            <div className="grid gap-3 sm:grid-cols-2 md:col-span-2 xl:col-span-2">
              <label className="block space-y-2">
                <span className="text-sm font-medium">Branch</span>
                <Select {...form.register('branchId')}>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </Select>
                {form.formState.errors.branchId ? (
                  <span className="text-xs text-red-600">{form.formState.errors.branchId.message}</span>
                ) : null}
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium">Source</span>
                <Select {...form.register('source')}>
                  <option value="WEBSITE">Website</option>
                  <option value="WALK_IN">Walk-in</option>
                  <option value="PHONE_CALL">Phone call</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="GOOGLE_ADS">Google Ads</option>
                  <option value="META_ADS">Meta Ads</option>
                </Select>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 md:col-span-2 xl:col-span-3">
              <label className="block space-y-2">
                <span className="text-sm font-medium">Priority</span>
                <Select {...form.register('priority')}>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </Select>
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium">Interested treatment</span>
                <Input {...form.register('interestedTreatment')} />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 md:col-span-2 xl:col-span-2">
              <label className="block space-y-2">
                <span className="text-sm font-medium">Next follow-up</span>
                <Input type="datetime-local" {...form.register('nextFollowupAt')} />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium">Last contacted</span>
                <Input type="datetime-local" {...form.register('lastContactedAt')} />
              </label>
            </div>

            <label className="block space-y-2 md:col-span-2 xl:col-span-1">
              <span className="text-sm font-medium">Follow-up notes</span>
              <Input {...form.register('followupNotes')} />
            </label>

            {createLead.error || updateLead.error ? (
              <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 md:col-span-2 xl:col-span-3">
                {createLead.error?.message ?? updateLead.error?.message}
              </div>
            ) : null}

            <div className="flex gap-3 md:col-span-2 xl:col-span-3">
              <Button type="submit" disabled={createLead.isPending || updateLead.isPending}>
                <Plus className="size-4" />
                {editingLead ? 'Save Lead' : 'Create Lead'}
              </Button>

              {editingLead ? (
                <Button type="button" variant="secondary" onClick={() => { setShowLeadForm(false); resetCreateForm(); }}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>
        </Card>
        </div>
      ) : null}

      <div className="space-y-5">
        <Card>
          <div className="mb-4 grid gap-3 md:grid-cols-[1fr_180px_180px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search name or mobile"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <Select
              aria-label="Status filter"
              value={status}
              onChange={(event) => setStatus(event.target.value as LeadStatus | '')}
            >
              <option value="">All statuses</option>
              {leadStatuses.map((leadStatus) => (
                <option key={leadStatus.value} value={leadStatus.value}>
                  {leadStatus.label}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Source filter"
              value={source}
              onChange={(event) => setSource(event.target.value as LeadSource | '')}
            >
              <option value="">All sources</option>
              <option value="GOOGLE_ADS">Google Ads</option>
              <option value="META_ADS">Meta Ads</option>
              <option value="WEBSITE">Website</option>
              <option value="PHONE_CALL">Phone call</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="WALK_IN">Walk-in</option>
            </Select>
          </div>

          <div className="overflow-x-auto rounded-md border border-border">
            <table className="min-w-[900px] w-full border-collapse text-left text-sm">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Mobile / Source</th>
                  <th className="px-4 py-3 font-medium">Branch</th>
                  <th className="px-4 py-3 font-medium">Campaign</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>

              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="cursor-pointer border-t border-border hover:bg-muted/50" onClick={() => setSelectedLead(lead)}>
                    <td className="px-4 py-3 font-medium">
                      <button
                        className="text-left hover:text-primary"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          startEdit(lead);
                        }}
                      >
                        {lead.name}
                      </button>
                      <div className="text-xs text-muted-foreground">
                        {lead.priority ?? 'MEDIUM'} · {lead.interestedTreatment ?? 'No treatment set'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-muted-foreground">{lead.mobile}</div>
                      <div className="text-xs text-muted-foreground">{lead.email ?? '-'}</div>
                      <div className="text-xs text-muted-foreground">{sourceLabel(lead.source)}</div>
                    </td>
                    <td className="px-4 py-3">{lead.branch?.name ?? 'Branch'}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {lead.adLeads?.[0] ? (
                        <div>
                          <div>{lead.adLeads[0].campaignName ?? '-'}</div>
                          <div className="text-xs">{lead.adLeads[0].adName ?? lead.adLeads[0].formName ?? '-'}</div>
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Select
                        aria-label="Lead status"
                        value={leadStatuses.some((leadStatus) => leadStatus.value === lead.status) ? lead.status : ''}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) =>
                          updateLead.mutate({
                            id: lead.id,
                            values: { status: event.target.value as LeadStatus },
                          })
                        }
                      >
                        <option value="" disabled>Choose status</option>
                        {leadStatuses.map((leadStatus) => (
                          <option key={leadStatus.value} value={leadStatus.value}>
                            {leadStatus.label}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
                        <Button type="button" variant="secondary" aria-label="Call lead" title="Call lead" className="w-10 px-0" onClick={() => window.location.href = `tel:${lead.mobile}`}>
                          <PhoneCall className="size-4" />
                        </Button>
                        <Button type="button" variant="secondary" aria-label="Edit lead" title="Edit lead" className="w-10 px-0" onClick={() => startEdit(lead)}>
                          <Edit3 className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          aria-label="Convert to appointment"
                          title="Convert to appointment"
                          className="w-10 px-0"
                          onClick={() => startBooking(lead)}
                        >
                          <CalendarPlus className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}

                {!leadsQuery.isLoading && leads.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>
                      No leads found.
                    </td>
                  </tr>
                ) : null}

                {leadsQuery.isLoading ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>
                      Loading leads...
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {selectedLead ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/30 p-4">
          <Card className="mx-auto max-w-4xl">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">{selectedLead.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {selectedLead.mobile} · {sourceLabel(selectedLead.source)} · {selectedLead.branch?.name ?? 'Branch'}
                </p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={() => startEdit(selectedLead)}>
                  <Edit3 className="size-4" />
                  Edit
                </Button>
                <Button type="button" variant="secondary" onClick={() => startBooking(selectedLead)}>
                  <CalendarPlus className="size-4" />
                  Book
                </Button>
                <Button type="button" variant="secondary" onClick={() => setSelectedLead(null)}>
                  Close
                </Button>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Detail label="Priority" value={selectedLead.priority ?? 'MEDIUM'} />
              <Detail label="Status" value={selectedLead.status.replace('_', ' ')} />
              <Detail label="Interested treatment" value={selectedLead.interestedTreatment ?? '-'} />
              <Detail label="Next follow-up" value={formatDateTime(selectedLead.nextFollowupAt)} />
              <Detail label="Last contacted" value={formatDateTime(selectedLead.lastContactedAt)} />
              <Detail label="Email" value={selectedLead.email ?? '-'} />
              <Detail label="Campaign" value={selectedLead.adLeads?.[0]?.campaignName ?? '-'} />
              <Detail label="Follow-up notes" value={selectedLead.followupNotes ?? '-'} />
            </div>

            <div className="mt-6">
              <h3 className="font-semibold">Timeline</h3>
              <div className="mt-3 space-y-3">
                {selectedLeadTimelineQuery.data?.data.map((event) => (
                  <div key={event.id} className="rounded-md border border-border p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium">{event.title}</div>
                      <div className="text-xs text-muted-foreground">{formatDateTime(event.createdAt)}</div>
                    </div>
                    {event.description ? <div className="mt-1 text-muted-foreground">{event.description}</div> : null}
                  </div>
                ))}
                {!selectedLeadTimelineQuery.isLoading && selectedLeadTimelineQuery.data?.data.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                    No timeline events yet.
                  </div>
                ) : null}
              </div>
            </div>
          </Card>
        </div>
      ) : null}

      {bookingLead ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/30 p-4">
          <Card className="mx-auto max-w-3xl">
            <div>
              <h2 className="text-base font-semibold">Book Appointment</h2>
              <p className="text-sm text-muted-foreground">
                {bookingLead.name} · {bookingLead.mobile}
              </p>
            </div>
            <form
              className="mt-5 grid gap-4 md:grid-cols-2"
              onSubmit={bookingForm.handleSubmit((values) => bookAppointment.mutate({ lead: bookingLead, values }))}
            >
              <label className="block space-y-2">
                <span className="text-sm font-medium">Branch</span>
                <Select {...bookingForm.register('branchId')}>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium">Type</span>
                <Select {...bookingForm.register('appointmentType')}>
                  <option value="CLINIC_VISIT">Clinic visit</option>
                  <option value="VIDEO_CONSULTATION">Video consultation</option>
                </Select>
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium">Date and time</span>
                <Input type="datetime-local" {...bookingForm.register('appointmentAt')} />
                {bookingForm.formState.errors.appointmentAt ? (
                  <span className="text-xs text-red-600">{bookingForm.formState.errors.appointmentAt.message}</span>
                ) : null}
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium">Visit purpose</span>
                <Select {...bookingForm.register('resourceType')}><option value="CONSULTATION">Consultation</option><option value="TREATMENT_ROOM">Treatment / room</option></Select>
              </label>
              {bookingForm.watch('resourceType') === 'TREATMENT_ROOM' ? <label className="block space-y-2"><span className="text-sm font-medium">Treatment room</span><Select {...bookingForm.register('roomNumber')}><option value="">Select room</option>{[1,2,3,4].map((room) => <option key={room} value={room}>Room {room}</option>)}</Select>{bookingForm.formState.errors.roomNumber ? <span className="text-xs text-red-600">{bookingForm.formState.errors.roomNumber.message}</span> : null}</label> : null}
              <label className="block space-y-2">
                <span className="text-sm font-medium">Notes</span>
                <Input {...bookingForm.register('notes')} />
              </label>
              {bookAppointment.error ? (
                <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 md:col-span-2">
                  {bookAppointment.error.message}
                </div>
              ) : null}
              <div className="flex gap-3 md:col-span-2">
                <Button type="submit" disabled={bookAppointment.isPending}>
                  <CalendarPlus className="size-4" />
                  Book Appointment
                </Button>
                <Button type="button" variant="secondary" onClick={() => setBookingLead(null)}>
                  Close
                </Button>
              </div>
            </form>
          </Card>
        </div>
      ) : null}
    </section>
  );
}

function Endpoint({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
      <div className="flex items-center gap-2 font-medium">
        <Link2 className="size-4 text-primary" />
        {label}
      </div>
      <div className="mt-1 break-all text-muted-foreground">{value}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-white p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}

function ProgressLine({ label, value, total }: { label: string; value: number; total: number }) {
  const width = Math.max(percent(value, total), value ? 6 : 0);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">{percent(value, total)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function AnalyticsBars({ data, total }: { data: Array<{ label: string; value: number }>; total: number }) {
  return (
    <div className="mt-4 space-y-4">
      {data.length ? (
        data.map((item) => (
          <div key={item.label}>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="font-semibold">{item.value}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(percent(item.value, total), item.value ? 6 : 0)}%` }} />
            </div>
          </div>
        ))
      ) : (
        <div className="py-8 text-center text-sm text-muted-foreground">No leads found for these filters.</div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}
