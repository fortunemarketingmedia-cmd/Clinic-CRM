'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CalendarCheck,
  CalendarPlus,
  CheckCircle2,
  Flame,
  GripVertical,
  Phone,
  Search,
  Target,
  X,
  MessageSquareText,
} from 'lucide-react';
import { useMemo, useState, type DragEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { BoardSkeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/services/api';
import { useSessionStore } from '@/store/session-store';
import type { StaffMember } from '@/types/front-desk';
import type { ClinicResource, ClinicService } from '@/types/appointment';
import type { Lead, LeadStatus } from '@/types/lead';

type PipelineStage = {
  id: string;
  label: string;
  description: string;
  target: LeadStatus;
  statuses: LeadStatus[];
  marker: string;
};

type MovePayload = {
  status: LeadStatus;
  ownerId?: string;
  nextAction?: string;
  nextActionDueAt?: string;
  nextFollowupAt?: string;
  followupNotes?: string;
  qualificationNotes?: string;
  leadScore?: number;
  lostReason?: string;
  disqualificationReason?: string;
};

type MoveRequest = { lead: Lead; stage: PipelineStage };

const activeStages: PipelineStage[] = [
  {
    id: 'new',
    label: 'New enquiry',
    description: 'Fresh enquiries',
    target: 'ASSIGNED',
    statuses: ['NEW', 'UNASSIGNED', 'ASSIGNED'],
    marker: 'bg-slate-400',
  },
  {
    id: 'contacted',
    label: 'Contacted',
    description: 'Patient reached',
    target: 'CONNECTED',
    statuses: ['ATTEMPTING_CONTACT', 'CONNECTED'],
    marker: 'bg-amber-400',
  },
  {
    id: 'follow_up',
    label: 'Follow-up required',
    description: 'Next action needed',
    target: 'NURTURING',
    statuses: ['NURTURING', 'POSTPONED', 'NOT_ARRIVED', 'CANCELLED', 'APPOINTMENT_PROPOSED'],
    marker: 'bg-violet-500',
  },
];

const wonStage: PipelineStage = { id: 'won', label: 'Closed won', description: 'Appointment booked · visible 7 days', target: 'CONVERTED', statuses: ['APPOINTMENT_BOOKED', 'BOOKED', 'CONFIRMED', 'CONVERTED'], marker: 'bg-emerald-600' };
const lostStage: PipelineStage = { id: 'lost', label: 'Closed lost', description: 'Did not convert · visible 7 days', target: 'LOST', statuses: ['LOST', 'DISQUALIFIED'], marker: 'bg-red-500' };
const stages: PipelineStage[] = [...activeStages, wonStage, lostStage];

const closedStatuses = new Set<LeadStatus>(['APPOINTMENT_BOOKED', 'BOOKED', 'CONFIRMED', 'CONVERTED', 'LOST', 'DISQUALIFIED']);
const CLOSED_PIPELINE_VISIBILITY_DAYS = 7;
const CLOSED_PIPELINE_VISIBILITY_MS = CLOSED_PIPELINE_VISIBILITY_DAYS * 24 * 60 * 60 * 1000;

function isRecentlyClosed(lead: Lead, now = Date.now()) {
  if (!closedStatuses.has(lead.status)) return true;
  const closedAt = lead.closedAt ?? lead.convertedAt ?? lead.updatedAt ?? lead.createdAt;
  const closedAtTime = new Date(closedAt).getTime();
  return Number.isFinite(closedAtTime) && closedAtTime >= now - CLOSED_PIPELINE_VISIBILITY_MS;
}

function sourceLabel(value: Lead['source']) {
  return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDueDate(value?: string | null) {
  if (!value) return 'No next action set';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function defaultAppointmentDateTime() {
  const date = new Date();
  date.setHours(date.getHours() + 1, 0, 0, 0);
  return toDateTimeLocal(date.toISOString());
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'The lead could not be moved. Please try again.';
}

function stageForStatus(status: LeadStatus) {
  return stages.find((stage) => stage.statuses.includes(status)) ?? stages[0];
}

export function FollowUpsView() {
  const queryClient = useQueryClient();
  const { session, selectedBranchId, hasHydrated } = useSessionStore();
  const [search, setSearch] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [showAllClosed, setShowAllClosed] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropStageId, setDropStageId] = useState<string | null>(null);
  const [moveRequest, setMoveRequest] = useState<MoveRequest | null>(null);
  const [moveError, setMoveError] = useState('');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ includeClosed: 'true' });
    if (selectedBranchId) params.set('branchId', selectedBranchId);
    return params.toString();
  }, [selectedBranchId]);

  const leadsQuery = useQuery({
    queryKey: ['sales-pipeline', queryString],
    queryFn: () => apiRequest<{ data: Lead[] }>(`/leads?${queryString}`),
    enabled: hasHydrated && Boolean(session) && Boolean(session?.user.role === 'ADMIN' || selectedBranchId),
  });

  const staffQuery = useQuery({
    queryKey: ['pipeline-staff', selectedBranchId],
    queryFn: () =>
      apiRequest<{ data: StaffMember[] }>(
        `/front-desk/staff${selectedBranchId ? `?branchId=${selectedBranchId}` : ''}`,
      ),
    enabled: hasHydrated && Boolean(session),
  });

  const servicesQuery = useQuery({
    queryKey: ['pipeline-services', selectedBranchId],
    queryFn: () =>
      apiRequest<{ data: ClinicService[] }>(
        `/front-desk/services${selectedBranchId ? `?branchId=${selectedBranchId}` : ''}`,
      ),
    enabled: hasHydrated && Boolean(session),
  });

  const resourcesQuery = useQuery({
    queryKey: ['pipeline-resources', selectedBranchId],
    queryFn: () =>
      apiRequest<{ data: ClinicResource[] }>(
        `/front-desk/resources${selectedBranchId ? `?branchId=${selectedBranchId}` : ''}`,
      ),
    enabled: hasHydrated && Boolean(session),
  });

  const leads = useMemo(() => leadsQuery.data?.data ?? [], [leadsQuery.data]);
  const staff = useMemo(() => staffQuery.data?.data ?? [], [staffQuery.data]);
  const filteredLeads = useMemo(() => {
    const term = search.trim().toLowerCase();
    return leads.filter((lead) => {
      const matchesSearch =
        !term ||
        lead.name.toLowerCase().includes(term) ||
        lead.mobile.includes(term) ||
        lead.interestedTreatment?.toLowerCase().includes(term);
      return (
        matchesSearch &&
        (!ownerFilter || lead.ownerId === ownerFilter) &&
        (!sourceFilter || lead.source === sourceFilter) &&
        (!priorityFilter || lead.priority === priorityFilter)
      );
    });
  }, [leads, ownerFilter, priorityFilter, search, sourceFilter]);
  const pipelineLeads = useMemo(
    () => filteredLeads.filter((lead) => showAllClosed || isRecentlyClosed(lead)),
    [filteredLeads, showAllClosed],
  );

  const metrics = useMemo(() => {
    const now = Date.now();
    const active = leads.filter((lead) => !closedStatuses.has(lead.status)).length;
    const hot = leads.filter((lead) => lead.scoreCategory === 'HOT' || lead.priority === 'URGENT').length;
    const overdue = leads.filter(
      (lead) =>
        !closedStatuses.has(lead.status) &&
        Boolean(lead.nextActionDueAt) &&
        new Date(lead.nextActionDueAt!).getTime() < now,
    ).length;
    const booked = leads.filter((lead) => wonStage.statuses.includes(lead.status)).length;
    return { active, hot, overdue, booked };
  }, [leads]);

  const moveLead = useMutation({
    mutationFn: ({ lead, payload }: { lead: Lead; payload: MovePayload }) =>
      apiRequest<{ data: Lead }>(`/leads/${lead.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    onMutate: async ({ lead, payload }) => {
      setMoveError('');
      await queryClient.cancelQueries({ queryKey: ['sales-pipeline', queryString] });
      const previous = queryClient.getQueryData<{ data: Lead[] }>(['sales-pipeline', queryString]);
      const owner = staff.find((member) => member.id === payload.ownerId);
      queryClient.setQueryData<{ data: Lead[] }>(['sales-pipeline', queryString], (current) =>
        current
          ? {
              ...current,
              data: current.data.map((item) =>
                item.id === lead.id
                  ? {
                      ...item,
                      ...payload,
                      owner: owner ? { id: owner.id, name: owner.name } : item.owner,
                    }
                  : item,
              ),
            }
          : current,
      );
      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['sales-pipeline', queryString], context.previous);
      }
      setMoveError(getErrorMessage(error));
    },
    onSuccess: (response) => {
      queryClient.setQueryData<{ data: Lead[] }>(['sales-pipeline', queryString], (current) =>
        current
          ? {
              ...current,
              data: current.data.map((lead) => (lead.id === response.data.id ? response.data : lead)),
            }
          : current,
      );
      setMoveRequest(null);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });

  function requestMove(lead: Lead, stage: PipelineStage) {
    const currentStage = stageForStatus(lead.status);
    if (currentStage.id === stage.id) return;

    const needsActiveFields =
      !closedStatuses.has(stage.target) &&
      (!lead.ownerId || !lead.nextAction?.trim() || !lead.nextActionDueAt);
    const needsDetails =
      needsActiveFields ||
      stage.target === 'QUALIFIED' ||
      stage.target === 'LOST' ||
      stage.target === 'DISQUALIFIED' ||
      stage.target === 'APPOINTMENT_BOOKED' ||
      stage.id === 'won' ||
      stage.id === 'lost';

    if (needsDetails) {
      setMoveRequest({ lead, stage });
      return;
    }

    moveLead.mutate({ lead, payload: { status: stage.target } });
  }

  function handleDrop(event: DragEvent<HTMLDivElement>, stage: PipelineStage) {
    event.preventDefault();
    const leadId = event.dataTransfer.getData('text/lead-id') || draggingId;
    const lead = leads.find((item) => item.id === leadId);
    setDraggingId(null);
    setDropStageId(null);
    if (lead) requestMove(lead, stage);
  }

  if (!hasHydrated || leadsQuery.isLoading) {
    return (
      <section className="space-y-5">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Lead Journey</h1>
          <p className="mt-1 text-sm text-muted-foreground">Track every lead from first enquiry to a clear won or lost outcome.</p>
        </div>
        <BoardSkeleton columns={4} />
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Lead Journey</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Move every enquiry through contact, follow-up and appointment, then close it as won or lost.
          </p>
        </div>
        <a
          href="/leads"
          className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-medium text-foreground transition hover:bg-muted"
        >
          Manage leads
        </a>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PipelineMetric label="Active leads" value={metrics.active} icon={Target} />
        <PipelineMetric label="Hot leads" value={metrics.hot} icon={Flame} />
        <PipelineMetric label="Overdue actions" value={metrics.overdue} icon={AlertCircle} />
        <PipelineMetric label="Closed won / booked" value={metrics.booked} icon={CheckCircle2} />
      </div>

      <Card className="border-primary/20 bg-primary/5 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-semibold text-foreground">Required lead journey</h2>
            <p className="mt-1 text-sm text-muted-foreground">Every active lead must have an owner, a clear next action and a due time. Close only after recording the final outcome.</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
            {['New enquiry', 'Contacted', 'Follow-up required', 'Appointment booked = Closed won', 'Closed lost'].map((label, index) => (
              <div key={label} className="flex items-center gap-1.5">
                {index > 0 ? <span className="text-muted-foreground">→</span> : null}
                <span className="rounded-full border border-border bg-surface px-2.5 py-1">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_220px_180px_160px]">
          <label className="relative">
            <span className="sr-only">Search leads</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, mobile or treatment"
              className="pl-9"
            />
          </label>
          <Select aria-label="Filter by owner" value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)}>
            <option value="">All owners</option>
            {staff.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
          </Select>
          <Select aria-label="Filter by source" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
            <option value="">All sources</option>
            <option value="WEBSITE">Website</option>
            <option value="WALK_IN">Walk In</option>
            <option value="PHONE_CALL">Phone Call</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="GOOGLE_ADS">Google Ads</option>
            <option value="META_ADS">Meta Ads</option>
            <option value="OTHER">Other</option>
          </Select>
          <Select aria-label="Filter by priority" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
            <option value="">All priorities</option>
            <option value="URGENT">Urgent</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </Select>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">
            Closed won and lost leads remain on this board for {CLOSED_PIPELINE_VISIBILITY_DAYS} days, then stay available in Archived Leads.
          </p>
          <Button
            type="button"
            variant="secondary"
            aria-pressed={showAllClosed}
            onClick={() => setShowAllClosed((current) => !current)}
          >
            {showAllClosed ? 'Show recent closed only' : 'Show all closed'}
          </Button>
        </div>
      </Card>

      {moveError && (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground">
          <span className="flex items-center gap-2"><AlertCircle className="size-4 shrink-0 text-primary" />{moveError}</span>
          <button type="button" aria-label="Dismiss error" onClick={() => setMoveError('')}><X className="size-4" /></button>
        </div>
      )}

      <div className="-mx-4 overflow-x-auto px-4 pb-3 md:-mx-6 md:px-6 xl:-mx-8 xl:px-8">
        <div
          className="grid min-w-[1320px] overflow-hidden rounded-lg border border-border bg-muted/20"
          style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(190px, 1fr))` }}
        >
          {stages.map((stage) => {
            const stageLeads = pipelineLeads.filter((lead) => stage.statuses.includes(lead.status));
            const isDropTarget = dropStageId === stage.id;
            return (
              <div
                key={stage.id}
                onDragEnter={(event) => { event.preventDefault(); setDropStageId(stage.id); }}
                onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropStageId(null);
                }}
                onDrop={(event) => handleDrop(event, stage)}
                className={cn(
                  'min-h-[260px] border-l border-border p-2 first:border-l-0 transition',
                  isDropTarget && 'bg-primary/5 ring-2 ring-inset ring-primary/20',
                )}
              >
                <div className="-mx-2 -mt-2 mb-2 flex min-h-14 items-start justify-between gap-2 border-b border-border bg-surface px-2 py-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={cn('size-2 rounded-full', stage.marker)} />
                      <h2 className="text-xs font-semibold text-foreground">{stage.label}</h2>
                    </div>
                    <p className="mt-0.5 pl-4 text-[10px] text-muted-foreground">{stage.description}</p>
                  </div>
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {stageLeads.length}
                  </span>
                </div>

                <div className="space-y-2">
                  {stageLeads.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      moving={moveLead.isPending && moveLead.variables?.lead.id === lead.id}
                      onDragStart={(event) => {
                        setDraggingId(lead.id);
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('text/lead-id', lead.id);
                      }}
                      onDragEnd={() => { setDraggingId(null); setDropStageId(null); }}
                      onMove={(target) => {
                        const destination = stages.find((item) => item.target === target);
                        if (destination) requestMove(lead, destination);
                      }}
                      onOpen={() => setSelectedLead(lead)}
                      onCloseWon={() => requestMove(lead, wonStage)}
                      onCloseLost={() => requestMove(lead, lostStage)}
                    />
                  ))}
                  {!stageLeads.length && (
                    <div className={cn(
                      'flex min-h-16 items-center justify-center rounded-md border border-dashed border-border px-3 text-center text-[11px] text-muted-foreground',
                      isDropTarget && 'border-primary text-primary',
                    )}>
                      {draggingId ? `Drop lead in ${stage.label}` : 'No leads in this stage'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {!pipelineLeads.length && leads.length > 0 && (
        <p className="text-center text-sm text-muted-foreground">No leads match the selected filters.</p>
      )}

      {leadsQuery.isError && (
        <Card className="text-sm text-primary">Unable to load the sales pipeline. Please refresh and try again.</Card>
      )}

      {moveRequest && (
        <MoveLeadDialog
          key={`${moveRequest.lead.id}-${moveRequest.stage.id}`}
          request={moveRequest}
          staff={staff}
          services={servicesQuery.data?.data ?? []}
          resources={resourcesQuery.data?.data ?? []}
          saving={moveLead.isPending}
          error={moveError}
          onClose={() => { if (!moveLead.isPending) setMoveRequest(null); }}
          onConfirm={(payload) => moveLead.mutate({ lead: moveRequest.lead, payload })}
        />
      )}
      {selectedLead ? <LeadDetailsDialog lead={selectedLead} staff={staff} onClose={() => setSelectedLead(null)} onWon={() => { setSelectedLead(null); requestMove(selectedLead, wonStage); }} onLost={() => { setSelectedLead(null); requestMove(selectedLead, lostStage); }} /> : null}
    </section>
  );
}

function PipelineMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  icon: typeof Target;
}) {
  return (
    <Card className="flex items-center justify-between p-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
      </div>
      <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="size-5" /></span>
    </Card>
  );
}

function LeadCard({
  lead,
  moving,
  onDragStart,
  onDragEnd,
  onMove,
  onOpen,
  onCloseWon,
  onCloseLost,
}: {
  lead: Lead;
  moving: boolean;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onMove: (status: LeadStatus) => void;
  onOpen: () => void;
  onCloseWon: () => void;
  onCloseLost: () => void;
}) {
  const isClosed = closedStatuses.has(lead.status);
  const overdue =
    Boolean(lead.nextActionDueAt) &&
    !closedStatuses.has(lead.status) &&
    new Date(lead.nextActionDueAt!).getTime() < Date.now();
  return (
    <div
      draggable={!moving}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        'rounded-md border border-border bg-surface p-2 shadow-sm shadow-red-950/5 transition hover:border-primary/35 hover:shadow-md',
        moving && 'pointer-events-none opacity-60',
      )}
      onClick={onOpen}
    >
      <div className="flex items-start gap-1.5">
        <GripVertical className="mt-0.5 size-3.5 shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-1">
            <div className="min-w-0">
              <h3 className="truncate text-xs font-semibold text-foreground">{lead.name}</h3>
              <p className="truncate text-[10px] text-muted-foreground">
                {lead.owner?.name || 'Unassigned'} - {lead.mobile}
              </p>
            </div>
            {(lead.scoreCategory === 'HOT' || lead.priority === 'URGENT') && (
              <span title="Hot lead" className="rounded bg-primary/10 p-0.5 text-primary"><Flame className="size-3" /></span>
            )}
          </div>

          <p className="mt-1.5 truncate text-[11px] text-foreground">
            {lead.interestedTreatment || 'Treatment not specified'}
          </p>
          <div className="mt-1 flex items-center gap-1 overflow-hidden">
            <span className="truncate rounded-full bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">{sourceLabel(lead.source)}</span>
            <span className={cn(
              'shrink-0 rounded-full px-1.5 py-0.5 text-[9px]',
              lead.priority === 'URGENT' || lead.priority === 'HIGH'
                ? 'bg-primary/10 text-primary'
                : 'bg-muted text-muted-foreground',
            )}>
              {lead.priority.toLowerCase()}
            </span>
          </div>

          <div className="mt-1.5 border-t border-border pt-1.5">
            <p className={cn('flex min-w-0 items-center gap-1 text-[10px]', overdue ? 'font-medium text-primary' : 'text-muted-foreground')}>
              {isClosed ? <CheckCircle2 className="size-3 shrink-0" /> : <CalendarCheck className="size-3 shrink-0" />}
              <span className="truncate" title={isClosed ? `Final outcome: ${stageForStatus(lead.status).label}` : `${lead.nextAction || 'No next action'} - ${formatDueDate(lead.nextActionDueAt)}`}>
                {isClosed ? `Final outcome: ${stageForStatus(lead.status).label}` : lead.nextAction || formatDueDate(lead.nextActionDueAt)}
              </span>
            </p>
          </div>

          {lead.followupNotes ? <p className="mt-1.5 line-clamp-2 rounded bg-amber-50 px-1.5 py-1 text-[10px] text-amber-900"><MessageSquareText className="mr-1 inline size-3" />{lead.followupNotes}</p> : null}

          <div className="mt-1.5 flex items-center gap-1">
            <a onClick={(event) => event.stopPropagation()} aria-label={`Call ${lead.name}`} href={`tel:${lead.mobile}`} className="grid size-6 place-items-center rounded border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground">
              <Phone className="size-3" />
            </a>
            <button type="button" onClick={(event) => { event.stopPropagation(); onOpen(); }} className="inline-flex h-6 items-center gap-1 rounded border border-border px-1.5 text-[9px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"><MessageSquareText className="size-3" />Note / follow-up</button>
          </div>

          <Select
            aria-label={`Move ${lead.name} to another pipeline stage`}
            className="mt-1.5 h-7 w-full px-1.5 text-[10px]"
            value=""
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => { if (event.target.value) onMove(event.target.value as LeadStatus); }}
          >
            <option value="">Move to stage</option>
            {stages.filter((stage) => stage.id !== stageForStatus(lead.status).id).map((stage) => (
              <option key={stage.id} value={stage.target}>{stage.label}</option>
            ))}
          </Select>
          {!isClosed ? (
            <div className="mt-1.5 grid grid-cols-2 gap-1" onClick={(event) => event.stopPropagation()}>
              <button type="button" onClick={onCloseWon} className="rounded border border-emerald-200 bg-emerald-50 px-1 py-1 text-[9px] font-medium text-emerald-700 hover:bg-emerald-100">Close as won</button>
              <button type="button" onClick={onCloseLost} className="rounded border border-red-200 bg-red-50 px-1 py-1 text-[9px] font-medium text-red-700 hover:bg-red-100">Close as lost</button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MoveLeadDialog({
  request,
  staff,
  services,
  resources,
  saving,
  error,
  onClose,
  onConfirm,
}: {
  request: MoveRequest;
  staff: StaffMember[];
  services: ClinicService[];
  resources: ClinicResource[];
  saving: boolean;
  error: string;
  onClose: () => void;
  onConfirm: (payload: MovePayload) => void;
}) {
  const queryClient = useQueryClient();
  const { lead, stage } = request;
  const [ownerId] = useState(lead.ownerId ?? staff[0]?.id ?? '');
  const [nextAction, setNextAction] = useState(lead.nextAction ?? '');
  const [nextActionDueAt, setNextActionDueAt] = useState(toDateTimeLocal(lead.nextActionDueAt));
  const [qualificationNotes, setQualificationNotes] = useState(lead.qualificationNotes ?? '');
  const [leadScore, setLeadScore] = useState(lead.leadScore?.toString() ?? '');
  const [reason, setReason] = useState(lead.lostReason ?? '');
  const [targetStatus] = useState<LeadStatus>(stage.target);
  const [appointmentAt, setAppointmentAt] = useState(toDateTimeLocal(lead.appointmentAt) || defaultAppointmentDateTime());
  const [appointmentType, setAppointmentType] = useState<'CLINIC_VISIT' | 'VIDEO_CONSULTATION'>(lead.appointmentType ?? 'CLINIC_VISIT');
  const resourceType = 'CONSULTATION' as const;
  const [notes, setNotes] = useState(lead.followupNotes ?? '');
  const [validationError, setValidationError] = useState('');
  const needsActiveFields = !closedStatuses.has(targetStatus);
  const appointmentExists = Boolean(lead.appointmentAt || lead.appointments?.length);
  const bookingBlocked = stage.id === 'won' && !appointmentExists;
  void services;
  void resources;

  const bookAppointment = useMutation({
    mutationFn: () =>
      apiRequest('/appointments', {
        method: 'POST',
        body: JSON.stringify({
          leadId: lead.id,
          branchId: lead.branchId,
          appointmentAt: new Date(appointmentAt).toISOString(),
          appointmentType,
          resourceType,
          durationMinutes: 30,
          bufferMinutes: 10,
          doctorId: undefined,
          notes: notes.trim() || undefined,
          bookingSource: 'SALES_PIPELINE',
          bookingChannel: 'CRM',
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      queryClient.invalidateQueries({ queryKey: ['daily-client-queue'] });
      onClose();
    },
    onError: (bookingError) => {
      setValidationError(getErrorMessage(bookingError));
    },
  });

  function submit() {
    setValidationError('');
    if (bookingBlocked) return;
    if (needsActiveFields && (!ownerId || !nextAction.trim() || !nextActionDueAt)) {
      setValidationError('Next action and due date are required for an active pipeline stage.');
      return;
    }
    if (targetStatus === 'QUALIFIED' && (!qualificationNotes.trim() || leadScore === '')) {
      setValidationError('Qualification notes and lead score are required.');
      return;
    }
    if ((targetStatus === 'LOST' || targetStatus === 'DISQUALIFIED') && !reason.trim()) {
      setValidationError('Please add a reason before closing this lead.');
      return;
    }
    if (targetStatus === 'CONVERTED' && !notes.trim()) {
      setValidationError('Please record the successful outcome before closing this lead as won.');
      return;
    }

    const payload: MovePayload = { status: targetStatus };
    if (needsActiveFields) {
      payload.ownerId = ownerId;
      payload.nextAction = nextAction.trim();
      payload.nextActionDueAt = new Date(nextActionDueAt).toISOString();
      payload.nextFollowupAt = new Date(nextActionDueAt).toISOString();
      payload.followupNotes = notes.trim() || undefined;
    }
    if (targetStatus === 'QUALIFIED') {
      payload.qualificationNotes = qualificationNotes.trim();
      payload.leadScore = Number(leadScore);
    }
    if (targetStatus === 'LOST') payload.lostReason = reason.trim();
    if (targetStatus === 'DISQUALIFIED') payload.disqualificationReason = reason.trim();
    if (targetStatus === 'CONVERTED') payload.followupNotes = notes.trim();
    onConfirm(payload);
  }

  function submitAppointment() {
    setValidationError('');
    if (!appointmentAt) {
      setValidationError('Appointment date and time are required.');
      return;
    }
    bookAppointment.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4" role="dialog" aria-modal="true" aria-labelledby="move-lead-title">
      <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto p-0">
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div>
            <h2 id="move-lead-title" className="text-lg font-semibold text-foreground">Move to {stage.label}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{lead.name}</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close" className="rounded-md p-1 text-muted-foreground hover:bg-muted">
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {bookingBlocked ? (
            <div className="space-y-4 rounded-lg border border-primary/25 bg-primary/5 p-4">
              <div>
                <p className="font-medium text-foreground">Book appointment now</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create the appointment here and the lead will move to Appointment Booked automatically.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Appointment time">
                  <Input type="datetime-local" value={appointmentAt} onChange={(event) => setAppointmentAt(event.target.value)} />
                </Field>
                <Field label="Appointment type">
                  <Select className="w-full" value={appointmentType} onChange={(event) => setAppointmentType(event.target.value as 'CLINIC_VISIT' | 'VIDEO_CONSULTATION')}>
                    <option value="CLINIC_VISIT">In-clinic consultancy</option>
                    <option value="VIDEO_CONSULTATION">Video consultation</option>
                  </Select>
                </Field>
                <Field label="Visit purpose">
                  <div className="flex h-10 items-center rounded-md border border-border bg-muted/40 px-3 text-sm">Consultation</div>
                </Field>
              </div>
              <Field label="Notes">
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  placeholder="Add appointment instructions or preferred slot details"
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </Field>
            </div>
          ) : (
            <>
              {needsActiveFields && (
                <>

                  <Field label="Next action">
                    <Input value={nextAction} onChange={(event) => setNextAction(event.target.value)} placeholder="Example: Call to confirm preferred appointment time" />
                  </Field>
                  <Field label="Next action due">
                    <Input type="datetime-local" value={nextActionDueAt} onChange={(event) => setNextActionDueAt(event.target.value)} />
                  </Field>
                  <Field label="Lead note">
                    <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Add context for the receptionist taking this follow-up" className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
                  </Field>
                </>
              )}

              {targetStatus === 'QUALIFIED' && (
                <>
                  <Field label="Qualification notes">
                    <textarea
                      value={qualificationNotes}
                      onChange={(event) => setQualificationNotes(event.target.value)}
                      rows={3}
                      placeholder="Why is this lead qualified?"
                      className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                    />
                  </Field>
                  <Field label="Lead score (0-100)">
                    <Input type="number" min={0} max={100} value={leadScore} onChange={(event) => setLeadScore(event.target.value)} />
                  </Field>
                </>
              )}

              {targetStatus === 'LOST' && (
                <Field label="Lost reason">
                  <textarea
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    rows={3}
                    placeholder="Add a clear reason for the team"
                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                </Field>
              )}
              {targetStatus === 'CONVERTED' && (
                <Field label="Won outcome">
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    rows={3}
                    placeholder="Record what converted, such as consultation booked, package selected, or payment received"
                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                </Field>
              )}
            </>
          )}

          {(validationError || error) && (
            <p role="alert" className="flex items-start gap-2 text-sm text-primary">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />{validationError || error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border p-4">
          <Button variant="secondary" type="button" onClick={onClose} disabled={saving || bookAppointment.isPending}>Cancel</Button>
          {bookingBlocked ? (
            <Button type="button" onClick={submitAppointment} disabled={bookAppointment.isPending}>
              <CalendarPlus className="size-4" />
              {bookAppointment.isPending ? 'Booking...' : 'Book appointment'}
            </Button>
          ) : (
            <Button type="button" onClick={submit} disabled={saving}>{saving ? 'Moving...' : 'Move lead'}</Button>
          )}
        </div>
      </Card>
    </div>
  );
}

function LeadDetailsDialog({ lead, staff, onClose, onWon, onLost }: { lead: Lead; staff: StaffMember[]; onClose: () => void; onWon: () => void; onLost: () => void }) {
  const client = useQueryClient();
  const [note, setNote] = useState(lead.followupNotes ?? '');
  const [followUpAt, setFollowUpAt] = useState(toDateTimeLocal(lead.nextActionDueAt));
  const [assignedUserId, setAssignedUserId] = useState(lead.ownerId ?? staff[0]?.id ?? '');
  const [formError, setFormError] = useState('');
  const saveNote = useMutation({
    mutationFn: () => apiRequest(`/leads/${lead.id}`, { method: 'PATCH', body: JSON.stringify({ followupNotes: note.trim() }) }),
    onSuccess: () => { client.invalidateQueries({ queryKey: ['sales-pipeline'] }); client.invalidateQueries({ queryKey: ['leads'] }); onClose(); },
    onError: (error) => setFormError(getErrorMessage(error)),
  });
  const schedule = useMutation({
    mutationFn: () => {
      const dueAt = new Date(followUpAt);
      const reminderAt = new Date(Math.max(Date.now(), dueAt.getTime() - 15 * 60_000));
      return apiRequest('/follow-ups', { method: 'POST', body: JSON.stringify({
      personId: lead.personId, leadId: lead.id, patientId: lead.patient?.id,
      assignedUserId, branchId: lead.branchId, activityType: 'Lead follow-up',
      channel: 'CALL', direction: 'OUTBOUND', dueAt: dueAt.toISOString(),
      reminderAt: reminderAt.toISOString(), notes: note.trim() || undefined,
      priority: lead.priority, source: 'SALES_PIPELINE',
      }) });
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['sales-pipeline'] }); client.invalidateQueries({ queryKey: ['notification-follow-ups'] }); client.invalidateQueries({ queryKey: ['header-reminders'] }); client.invalidateQueries({ queryKey: ['dashboard-overview'] }); onClose();
    },
    onError: (error) => setFormError(getErrorMessage(error)),
  });
  function scheduleReminder() {
    setFormError('');
    if (!lead.personId) return setFormError('This lead is missing its linked contact record. Open the lead profile and save the contact details first.');
    if (!followUpAt || !assignedUserId) return setFormError('Select the follow-up date, time, and team member.');
    if (new Date(followUpAt).getTime() <= Date.now()) return setFormError('Follow-up date and time must be in the future.');
    schedule.mutate();
  }
  const saving = saveNote.isPending || schedule.isPending;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4" role="dialog" aria-modal="true" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><Card className="max-h-[92vh] w-full max-w-2xl overflow-y-auto"><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">{lead.name}</h2><p className="mt-1 text-sm text-muted-foreground">{lead.mobile} · {sourceLabel(lead.source)}</p></div><button type="button" onClick={onClose} aria-label="Close details" className="rounded-md p-1 text-muted-foreground hover:bg-muted"><X className="size-5" /></button></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><Detail label="Journey stage" value={stageForStatus(lead.status).label} /><Detail label="Assigned to" value={lead.owner?.name ?? 'Unassigned'} /><Detail label="Treatment / service" value={lead.interestedTreatment ?? '-'} /><Detail label="Priority" value={lead.priority} /><Detail label="Next action" value={lead.nextAction ?? '-'} /><Detail label="Due" value={formatDueDate(lead.nextActionDueAt)} /><Detail label="Email" value={lead.email ?? '-'} breakWords /></div><div className="mt-5 space-y-4 rounded-lg border border-border bg-muted/20 p-4"><div><h3 className="font-semibold">Lead note & followup</h3><p className="text-sm text-muted-foreground">The note stays with the lead. The assigned team member receives an in-app notification 15 minutes before the scheduled followup.</p></div><Field label="Lead note"><textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Write call context, preference, or follow-up instructions" className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" /></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="Followup date & time"><Input type="datetime-local" value={followUpAt} onChange={(event) => setFollowUpAt(event.target.value)} /></Field><Field label="Assign followup to"><Select className="w-full" value={assignedUserId} onChange={(event) => setAssignedUserId(event.target.value)}><option value="">Select team member</option>{staff.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</Select></Field></div>{formError ? <p role="alert" className="text-sm text-red-600">{formError}</p> : null}<div className="flex flex-wrap gap-2"><Button type="button" variant="secondary" disabled={!note.trim() || saving} onClick={() => saveNote.mutate()}>Save note</Button><Button type="button" disabled={saving} onClick={scheduleReminder}><CalendarPlus className="size-4" />{schedule.isPending ? 'Scheduling...' : 'Schedule followup'}</Button></div></div><div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-border pt-4"><Button type="button" variant="secondary" onClick={onClose}>Close</Button><Button type="button" variant="secondary" className="border-red-200 text-red-700" onClick={onLost}>Close as lost</Button><Button type="button" onClick={onWon}>Close as won</Button></div></Card></div>;
}

function Detail({ label, value, breakWords = false }: { label: string; value: string; breakWords?: boolean }) {
  return <div className="rounded-md border border-border p-3"><div className="text-xs text-muted-foreground">{label}</div><div className={cn('mt-1 text-sm font-medium', breakWords && 'break-all')}>{value}</div></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}
