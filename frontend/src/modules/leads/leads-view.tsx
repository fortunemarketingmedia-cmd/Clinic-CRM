'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit3, Link2, Megaphone, Plus, Search, TrendingUp, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { apiRequest } from '@/services/api';
import { useSessionStore } from '@/store/session-store';
import type { AdLead, AdPlatform } from '@/types/ad-lead';
import type { Branch } from '@/types/branch';
import type { Lead, LeadStatus, TimelineEvent } from '@/types/lead';

const leadStatuses: Array<{ label: string; value: LeadStatus }> = [
  { label: 'New enquiry', value: 'ASSIGNED' },
  { label: 'Contacted', value: 'CONNECTED' },
  { label: 'Follow-up required', value: 'NURTURING' },
  { label: 'Appointment booked', value: 'APPOINTMENT_BOOKED' },
];

const leadSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  mobile: z.string().min(8, 'Mobile number is required'),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  source: z.enum(['WEBSITE', 'WALK_IN', 'PHONE_CALL', 'WHATSAPP', 'GOOGLE_ADS', 'META_ADS', 'OTHER']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  nextFollowupAt: z.string().optional(),
  lastContactedAt: z.string().optional(),
  followupNotes: z.string().optional(),
  interestedTreatment: z.string().optional(),
  branchId: z.string().min(1, 'Branch is required'),
});

type LeadFormValues = z.infer<typeof leadSchema>;
type LeadSource = Lead['source'];
type LeadTab = 'ALL' | 'MANUAL' | 'GOOGLE_ADS' | 'META_ADS' | 'CAMPAIGN_ANALYTICS' | 'ARCHIVED';

type AdLeadResponse = {
  leads: AdLead[];
  stats: Array<{ platform: AdPlatform; _count: { id: number } }>;
};

function sourceLabel(source: Lead['source']) {
  return source.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function tabsLabel(tab: LeadTab) {
  if (tab === 'MANUAL') return 'Manual leads';
  if (tab === 'GOOGLE_ADS') return 'Google Ads';
  if (tab === 'META_ADS') return 'Meta Ads';
  if (tab === 'CAMPAIGN_ANALYTICS') return 'Campaigns';
  if (tab === 'ARCHIVED') return 'Closed / archived';
  return 'All leads';
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
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [activeTab, setActiveTab] = useState<LeadTab>('ALL');
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [archiveOutcome, setArchiveOutcome] = useState('');
  const [archiveOwner, setArchiveOwner] = useState('');
  const [archiveTreatment, setArchiveTreatment] = useState('');
  const [archiveLostReason, setArchiveLostReason] = useState('');

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

    if (createdFrom && activeTab !== 'ARCHIVED') {
      params.set('createdFrom', new Date(createdFrom).toISOString());
    }

    if (createdTo && activeTab !== 'ARCHIVED') {
      params.set('createdTo', new Date(createdTo).toISOString());
    }

    params.set('includeClosed', 'true');
    return params.toString();
  }, [activeBranchId, activeTab, createdFrom, createdTo, isAdmin, search, source, status]);

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

  useEffect(() => {
    if (!editingLead && formBranchId) {
      form.setValue('branchId', formBranchId);
    }
  }, [editingLead, form, formBranchId]);

  const adLeadsQuery = useQuery({
    queryKey: ['ad-leads-summary', activeBranchId],
    queryFn: () => apiRequest<{ data: AdLeadResponse }>(`/ad-leads${activeBranchId ? `?branchId=${activeBranchId}` : ''}`),
    enabled: hasHydrated && Boolean(session) && isAdmin,
  });

  const duplicateQuery = useQuery({
    queryKey: ['lead-duplicates', form.watch('mobile'), form.watch('email'), form.watch('branchId')],
    queryFn: () => {
      const params = new URLSearchParams();
      const mobile = form.getValues('mobile').trim();
      const email = form.getValues('email')?.trim();
      if (mobile) params.set('mobile', mobile);
      if (email) params.set('email', email);
      if (form.getValues('branchId')) params.set('branchId', form.getValues('branchId'));
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
    onMutate: (variables) => {
      if (!variables.values.status) return;
      queryClient.setQueriesData<{ data: Lead[] }>({ queryKey: ['leads'] }, (current) =>
        current
          ? {
              ...current,
              data: current.data.map((lead) =>
                lead.id === variables.id ? { ...lead, status: variables.values.status! } : lead,
              ),
            }
          : current,
      );
      if (selectedLead?.id === variables.id) {
        setSelectedLead({ ...selectedLead, status: variables.values.status });
      }
    },
    onSuccess: (response) => {
      const updatedLead = response.data;
      queryClient.setQueriesData<{ data: Lead[] }>({ queryKey: ['leads'] }, (current) =>
        current ? { ...current, data: current.data.map((lead) => (lead.id === updatedLead.id ? updatedLead : lead)) } : current,
      );
      if (selectedLead?.id === updatedLead.id) setSelectedLead(updatedLead);
      setEditingLead(null);
      setShowLeadForm(false);
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
    onError: (_error, variables) => {
      if (variables.values.status) {
        queryClient.invalidateQueries({ queryKey: ['leads'] });
      }
    },
  });

  function startEdit(lead: Lead) {
    setSelectedLead(null);
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
    const isArchived = (lead: Lead) => ['CONVERTED', 'LOST', 'DISQUALIFIED'].includes(lead.status);
    if (activeTab === 'ARCHIVED') return rows.filter(isArchived).filter((lead) => {
      const closedAt = new Date(lead.updatedAt ?? lead.createdAt).getTime();
      return (!archiveOutcome || (archiveOutcome === 'WON' ? lead.status === 'CONVERTED' : ['LOST', 'DISQUALIFIED'].includes(lead.status))) &&
        (!archiveOwner || lead.ownerId === archiveOwner) &&
        (!archiveTreatment || lead.interestedTreatment?.toLowerCase().includes(archiveTreatment.toLowerCase())) &&
        (!archiveLostReason || lead.lostReason?.toLowerCase().includes(archiveLostReason.toLowerCase())) &&
        (!createdFrom || closedAt >= new Date(createdFrom).getTime()) &&
        (!createdTo || closedAt <= new Date(createdTo).getTime());
    });
    const activeRows = rows.filter((lead) => !isArchived(lead));
    return activeTab === 'MANUAL' ? activeRows.filter((lead) => lead.source !== 'GOOGLE_ADS' && lead.source !== 'META_ADS') : activeRows;
  }, [activeTab, archiveLostReason, archiveOutcome, archiveOwner, archiveTreatment, createdFrom, createdTo, leadsQuery.data]);
  const adLeads = adLeadsQuery.data?.data.leads ?? [];
  const leadAnalytics = useMemo(() => {
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
      campaignRows: Array.from(campaignCounts.values()).sort((a, b) => b.value - a.value).slice(0, 5),
      qualified: leads.filter((lead) => lead.status === 'QUALIFIED').length,
      open: leads.filter((lead) => !['CONVERTED', 'LOST', 'DISQUALIFIED', 'CANCELLED'].includes(lead.status)).length,
      adAttributed: leads.filter((lead) => lead.source === 'GOOGLE_ADS' || lead.source === 'META_ADS' || (lead.adLeads?.length ?? 0) > 0).length,
    };
  }, [adLeads, leads]);
  const duplicateMatches = duplicateQuery.data?.data;
  const clearFilters = () => {
    setSearch('');
    setStatus('');
    setSource('');
    setCreatedFrom('');
    setCreatedTo('');
    setActiveTab('ALL');
    setArchiveOutcome('');
    setArchiveOwner('');
    setArchiveTreatment('');
    setArchiveLostReason('');
  };
  const activeFilterLabels = [
    activeTab !== 'ALL' ? tabsLabel(activeTab) : undefined,
    search.trim() ? `Search: ${search.trim()}` : undefined,
    status ? `Status: ${leadStatuses.find((leadStatus) => leadStatus.value === status)?.label ?? status}` : undefined,
    source ? `Source: ${sourceLabel(source)}` : undefined,
    createdFrom ? `From: ${formatDateTime(createdFrom)}` : undefined,
    createdTo ? `To: ${formatDateTime(createdTo)}` : undefined,
  ].filter(Boolean) as string[];
  const tabs: Array<{ label: string; value: LeadTab }> = [
    { label: 'All', value: 'ALL' },
    { label: 'Manual', value: 'MANUAL' },
    { label: 'Google Ads', value: 'GOOGLE_ADS' },
    { label: 'Meta Ads', value: 'META_ADS' },
    { label: 'Campaigns', value: 'CAMPAIGN_ANALYTICS' },
    { label: 'Closed / Archived', value: 'ARCHIVED' },
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
        </div>
      </div>

      <Card>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="font-semibold">Lead analytics</h2>
            <p className="text-sm text-muted-foreground">Numbers update automatically from the selected tab and filters.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {activeFilterLabels.length ? activeFilterLabels.map((item) => (
              <span key={item} className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">{item}</span>
            )) : <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">No extra filters</span>}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Metric label="Total leads" value={leadAnalytics.total} />
          <Metric label="Open leads" value={leadAnalytics.open} />
          <Metric label="Qualified leads" value={leadAnalytics.qualified} />
          <Metric label="Qualification %" value={percent(leadAnalytics.qualified, leadAnalytics.total)} suffix="%" />
          <Metric label="Ad attributed" value={leadAnalytics.adAttributed} />
        </div>

      </Card>

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

      {activeTab === 'CAMPAIGN_ANALYTICS' ? (
        <div className="grid gap-5 xl:grid-cols-2">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Campaign summary</h2>
                <p className="text-sm text-muted-foreground">Google and Meta leads grouped by campaign, form, or ad name.</p>
              </div>
              <Megaphone className="size-5 text-primary" />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Metric label="Google Ads" value={googleCount} />
              <Metric label="Meta Ads" value={metaCount} />
              <Metric label="Total campaign leads" value={googleCount + metaCount} />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {leadAnalytics.campaignRows.length ? (
                leadAnalytics.campaignRows.map((campaign) => (
                  <div key={`${campaign.platform}-${campaign.label}`} className="rounded-md border border-border p-3">
                    <div className="text-xs font-medium text-muted-foreground">{campaign.platform === 'GOOGLE' ? 'Google Ads' : 'Meta Ads'}</div>
                    <div className="mt-1 text-sm font-semibold">{campaign.label}</div>
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
                <div className="rounded-md border border-dashed border-border py-8 text-center text-sm text-muted-foreground sm:col-span-2">
                  Campaign data will appear as soon as Google or Meta starts sending leads.
                </div>
              )}
            </div>
          </Card>

          {isAdmin ? (
            <Card className="xl:col-span-2">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <TrendingUp className="size-5" />
                </div>
                <div>
                  <h2 className="font-semibold">Google & Meta lead form endpoints</h2>
                  <p className="text-sm text-muted-foreground">Use these only while connecting website or ad forms.</p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Endpoint label="Google Ads endpoint" value={`${publicBase}/ads/google`} />
                <Endpoint label="Meta Ads endpoint" value={`${publicBase}/ads/meta`} />
              </div>
            </Card>
          ) : null}
        </div>
      ) : null}

      {showLeadForm || editingLead ? (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/45 p-3 backdrop-blur-[2px] sm:p-6" role="dialog" aria-modal="true" aria-labelledby="lead-form-title" onMouseDown={(event) => { if (event.target === event.currentTarget) { setShowLeadForm(false); resetCreateForm(); } }}>
        <Card className="mx-auto max-w-5xl shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-border pb-4"><div><h2 id="lead-form-title" className="text-xl font-semibold">{editingLead ? 'Edit Lead' : 'Add New Lead'}</h2><p className="mt-1 text-sm text-muted-foreground">{editingLead ? 'Update the lead contact and treatment interest.' : 'Capture the essential details for a new enquiry.'}</p></div><Button type="button" variant="secondary" className="w-10 shrink-0 px-0" aria-label="Close lead form" onClick={() => { setShowLeadForm(false); resetCreateForm(); }}><X className="size-4" /></Button></div>

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
                      Patient: {patient.fullName} - {patient.mobile} - {patient.patientNo}
                    </div>
                  ))}
                  {duplicateMatches.leads.map((lead) => (
                    <button key={lead.id} type="button" className="block text-left underline" onClick={() => setSelectedLead(lead)}>
                      View existing lead: {lead.name} - {lead.mobile} - {lead.status.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <label className="block space-y-2 md:col-span-2 xl:col-span-1">
              <span className="text-sm font-medium">Address</span>
              <Input {...form.register('address')} />
            </label>

            <input type="hidden" {...form.register('branchId')} />
            <div className="grid gap-3 md:col-span-2 xl:col-span-2">
              <label className="block space-y-2">
                <span className="text-sm font-medium">Source</span>
                <Select {...form.register('source')}>
                  <option value="WEBSITE">Website</option>
                  <option value="WALK_IN">Walk-in</option>
                  <option value="PHONE_CALL">Phone call</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="GOOGLE_ADS">Google Ads</option>
                  <option value="META_ADS">Meta Ads</option>
                  <option value="OTHER">Other</option>
                </Select>
              </label>
            </div>

            <label className="block space-y-2 md:col-span-2 xl:col-span-3">
              <span className="text-sm font-medium">Interested treatment</span>
              <Input {...form.register('interestedTreatment')} placeholder="Treatment or service the client asked about" />
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
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-semibold">Lead list</h2>
              <p className="text-sm text-muted-foreground">Search, filter, and open a lead to view its full details.</p>
            </div>
            <div className="text-sm font-medium text-muted-foreground">{leads.length} visible</div>
          </div>

          <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_170px_170px_210px_210px_auto]">
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
              <option value="OTHER">Other</option>
            </Select>

            <Input
              aria-label="Created from"
              type="datetime-local"
              value={createdFrom}
              onChange={(event) => setCreatedFrom(event.target.value)}
            />

            <Input
              aria-label="Created to"
              type="datetime-local"
              value={createdTo}
              onChange={(event) => setCreatedTo(event.target.value)}
            />

            <Button type="button" variant="secondary" onClick={clearFilters}>
              Reset
            </Button>
          </div>

          {activeTab === 'ARCHIVED' ? <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4"><Select aria-label="Closed outcome" value={archiveOutcome} onChange={(event) => setArchiveOutcome(event.target.value)}><option value="">Closed won & lost</option><option value="WON">Closed won</option><option value="LOST">Closed lost</option></Select><Select aria-label="Assigned staff" value={archiveOwner} onChange={(event) => setArchiveOwner(event.target.value)}><option value="">All assigned staff</option>{Array.from(new Map((leadsQuery.data?.data ?? []).filter((lead) => lead.owner).map((lead) => [lead.owner!.id, lead.owner!])).values()).map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}</Select><Input aria-label="Treatment or service" placeholder="Treatment or service" value={archiveTreatment} onChange={(event) => setArchiveTreatment(event.target.value)} /><Input aria-label="Lost reason" placeholder="Lost reason" value={archiveLostReason} onChange={(event) => setArchiveLostReason(event.target.value)} /></div> : null}

          <div className="overflow-x-auto rounded-md border border-border">
            <table className="min-w-[760px] w-full border-collapse text-left text-sm">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Mobile / Source</th>
                  <th className="px-4 py-3 font-medium">Branch</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Edit</th>
                </tr>
              </thead>

              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="cursor-pointer border-t border-border hover:bg-muted/50" onClick={() => setSelectedLead(lead)}>
                    <td className="px-4 py-3 font-medium">
                      <button type="button" className="text-left hover:text-primary" onClick={() => setSelectedLead(lead)}>{lead.name}</button>
                      <div className="text-xs text-muted-foreground">
                        {lead.priority ?? 'MEDIUM'} - {lead.interestedTreatment ?? 'No treatment set'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-muted-foreground">{lead.mobile}</div>
                      <div className="text-xs text-muted-foreground">{lead.email ?? '-'}</div>
                      <div className="text-xs text-muted-foreground">{sourceLabel(lead.source)}</div>
                    </td>
                    <td className="px-4 py-3">{lead.branch?.name ?? 'Branch'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                        {leadStatuses.find((leadStatus) => leadStatus.value === lead.status)?.label ?? lead.status.replaceAll('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
                        <Button type="button" variant="secondary" aria-label="Edit lead" title="Edit lead" className="w-10 px-0" onClick={() => startEdit(lead)}>
                          <Edit3 className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}

                {!leadsQuery.isLoading && leads.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-muted-foreground" colSpan={5}>
                      No leads found.
                    </td>
                  </tr>
                ) : null}

                {leadsQuery.isLoading ? (
                  Array.from({ length: 7 }, (_, row) => <tr key={row} className="border-t border-border">{Array.from({ length: 5 }, (_, column) => <td key={column} className="px-4 py-4"><Skeleton className={column === 0 ? 'h-5 w-32' : 'h-4 w-24'} /></td>)}</tr>)
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {selectedLead ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/30 p-4" role="dialog" aria-modal="true" aria-labelledby="lead-detail-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedLead(null); }}>
          <Card className="mx-auto max-w-4xl">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 id="lead-detail-title" className="text-xl font-semibold">{selectedLead.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {selectedLead.mobile} - {sourceLabel(selectedLead.source)} - {selectedLead.branch?.name ?? 'Branch'}
                </p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={() => startEdit(selectedLead)}>
                  <Edit3 className="size-4" />
                  Edit
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
              <Detail label="Email" value={selectedLead.email ?? '-'} breakWords />
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

function Metric({ label, value, suffix = '' }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-md border border-border bg-white p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}{suffix}</div>
    </div>
  );
}

function Detail({ label, value, breakWords = false }: { label: string; value: string | number; breakWords?: boolean }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-sm font-medium ${breakWords ? 'break-all' : ''}`}>{value}</div>
    </div>
  );
}
