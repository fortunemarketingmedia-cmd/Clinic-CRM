'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CalendarCheck,
  CalendarPlus,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Flame,
  GripVertical,
  MessageCircle,
  Phone,
  Search,
  Target,
  X,
} from 'lucide-react';
import Link from 'next/link';
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
  qualificationNotes?: string;
  leadScore?: number;
  lostReason?: string;
  disqualificationReason?: string;
};

type MoveRequest = { lead: Lead; stage: PipelineStage };

const stages: PipelineStage[] = [
  {
    id: 'new',
    label: 'New Lead',
    description: 'Fresh enquiries',
    target: 'ASSIGNED',
    statuses: ['NEW', 'UNASSIGNED', 'ASSIGNED'],
    marker: 'bg-slate-400',
  },
  {
    id: 'contacted',
    label: 'Contact Made',
    description: 'Outreach and nurturing',
    target: 'CONNECTED',
    statuses: ['ATTEMPTING_CONTACT', 'CONNECTED', 'NURTURING', 'POSTPONED', 'NOT_ARRIVED', 'CANCELLED'],
    marker: 'bg-amber-400',
  },
  {
    id: 'qualified',
    label: 'Needs Defined',
    description: 'Qualified opportunity',
    target: 'QUALIFIED',
    statuses: ['QUALIFIED'],
    marker: 'bg-violet-500',
  },
  {
    id: 'proposed',
    label: 'Appointment Proposed',
    description: 'Slot offered',
    target: 'APPOINTMENT_PROPOSED',
    statuses: ['APPOINTMENT_PROPOSED'],
    marker: 'bg-indigo-500',
  },
  {
    id: 'booked',
    label: 'Appointment Booked',
    description: 'Visit confirmed',
    target: 'APPOINTMENT_BOOKED',
    statuses: ['APPOINTMENT_BOOKED', 'BOOKED', 'CONFIRMED', 'ARRIVED'],
    marker: 'bg-emerald-500',
  },
  {
    id: 'closed',
    label: 'Closed',
    description: 'Won, lost or disqualified',
    target: 'CONVERTED',
    statuses: ['CONVERTED', 'LOST', 'DISQUALIFIED'],
    marker: 'bg-green-600',
  },
];

const closedStatuses = new Set<LeadStatus>(['CONVERTED', 'LOST', 'DISQUALIFIED']);

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
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropStageId, setDropStageId] = useState<string | null>(null);
  const [moveRequest, setMoveRequest] = useState<MoveRequest | null>(null);
  const [moveError, setMoveError] = useState('');

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
    const won = leads.filter((lead) => lead.status === 'CONVERTED').length;
    const closed = won + leads.filter((lead) => lead.status === 'LOST' || lead.status === 'DISQUALIFIED').length;
    return { active, hot, overdue, conversion: closed ? Math.round((won / closed) * 100) : 0 };
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
      stage.id === 'closed';

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
          <h1 className="text-2xl font-semibold text-foreground">Sales Pipeline</h1>
          <p className="mt-1 text-sm text-muted-foreground">Track every lead from first enquiry to conversion.</p>
        </div>
        <BoardSkeleton columns={4} />
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Sales Pipeline</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Drag leads between stages and keep the next sales action clear.
          </p>
        </div>
        <Link
          href="/leads"
          className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-medium text-foreground transition hover:bg-muted"
        >
          Manage leads <ExternalLink className="size-4" />
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PipelineMetric label="Active leads" value={metrics.active} icon={Target} />
        <PipelineMetric label="Hot leads" value={metrics.hot} icon={Flame} />
        <PipelineMetric label="Overdue actions" value={metrics.overdue} icon={AlertCircle} />
        <PipelineMetric label="Win rate" value={`${metrics.conversion}%`} icon={CheckCircle2} />
      </div>

      <Card className="p-4">
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
          </Select>
          <Select aria-label="Filter by priority" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
            <option value="">All priorities</option>
            <option value="URGENT">Urgent</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </Select>
        </div>
      </Card>

      {moveError && (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground">
          <span className="flex items-center gap-2"><AlertCircle className="size-4 shrink-0 text-primary" />{moveError}</span>
          <button type="button" aria-label="Dismiss error" onClick={() => setMoveError('')}><X className="size-4" /></button>
        </div>
      )}

      <div className="-mx-4 overflow-x-auto px-4 pb-3 md:-mx-6 md:px-6 xl:-mx-8 xl:px-8">
        <div className="grid min-w-[1120px] grid-cols-6 overflow-hidden rounded-lg border border-border bg-muted/20">
          {stages.map((stage) => {
            const stageLeads = filteredLeads.filter((lead) => stage.statuses.includes(lead.status));
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
                  'min-h-[440px] border-l border-border p-2 first:border-l-0 transition',
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

                <div className="min-h-32 space-y-2">
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
                    />
                  ))}
                  {!stageLeads.length && (
                    <div className={cn(
                      'flex min-h-20 items-center justify-center rounded-md border border-dashed border-border px-3 text-center text-[11px] text-muted-foreground',
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

      {!filteredLeads.length && leads.length > 0 && (
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
}: {
  lead: Lead;
  moving: boolean;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onMove: (status: LeadStatus) => void;
}) {
  const overdue =
    Boolean(lead.nextActionDueAt) &&
    !closedStatuses.has(lead.status) &&
    new Date(lead.nextActionDueAt!).getTime() < Date.now();
  const whatsappNumber = lead.mobile.replace(/\D/g, '');

  return (
    <div
      draggable={!moving}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        'rounded-md border border-border bg-surface p-2 shadow-sm shadow-red-950/5 transition hover:border-primary/35 hover:shadow-md',
        moving && 'pointer-events-none opacity-60',
      )}
    >
      <div className="flex items-start gap-1.5">
        <GripVertical className="mt-0.5 size-3.5 shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-1">
            <div className="min-w-0">
              <h3 className="truncate text-xs font-semibold text-foreground">{lead.name}</h3>
              <p className="truncate text-[10px] text-muted-foreground">
                {lead.owner?.name || 'Unassigned'} · {lead.mobile}
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
              <CalendarCheck className="size-3 shrink-0" />
              <span className="truncate" title={`${lead.nextAction || 'No next action'} · ${formatDueDate(lead.nextActionDueAt)}`}>
                {lead.nextAction || formatDueDate(lead.nextActionDueAt)}
              </span>
            </p>
          </div>

          <div className="mt-1.5 flex items-center gap-1">
            <a aria-label={`Call ${lead.name}`} href={`tel:${lead.mobile}`} className="grid size-6 place-items-center rounded border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground">
              <Phone className="size-3" />
            </a>
            <a aria-label={`WhatsApp ${lead.name}`} href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noreferrer" className="grid size-6 place-items-center rounded border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground">
              <MessageCircle className="size-3" />
            </a>
            <Link href={`/leads/${lead.id}`} className="ml-auto inline-flex h-6 items-center gap-0.5 rounded px-1 text-[10px] font-medium text-primary transition hover:bg-primary/5">
              Open <ChevronRight className="size-3" />
            </Link>
          </div>

          <Select
            aria-label={`Move ${lead.name} to another pipeline stage`}
            className="mt-1.5 h-7 w-full px-1.5 text-[10px]"
            value=""
            onChange={(event) => { if (event.target.value) onMove(event.target.value as LeadStatus); }}
          >
            <option value="">Move to stage…</option>
            {stages.filter((stage) => stage.id !== stageForStatus(lead.status).id).map((stage) => (
              <option key={stage.id} value={stage.target}>{stage.label}</option>
            ))}
          </Select>
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
  const [ownerId, setOwnerId] = useState(lead.ownerId ?? '');
  const [nextAction, setNextAction] = useState(lead.nextAction ?? '');
  const [nextActionDueAt, setNextActionDueAt] = useState(toDateTimeLocal(lead.nextActionDueAt));
  const [qualificationNotes, setQualificationNotes] = useState(lead.qualificationNotes ?? '');
  const [leadScore, setLeadScore] = useState(lead.leadScore?.toString() ?? '');
  const [reason, setReason] = useState(lead.lostReason ?? '');
  const [targetStatus, setTargetStatus] = useState<LeadStatus>(stage.target);
  const [appointmentAt, setAppointmentAt] = useState(toDateTimeLocal(lead.appointmentAt) || defaultAppointmentDateTime());
  const [appointmentType, setAppointmentType] = useState<'CLINIC_VISIT' | 'VIDEO_CONSULTATION'>(lead.appointmentType ?? 'CLINIC_VISIT');
  const [serviceId, setServiceId] = useState('');
  const [doctorId, setDoctorId] = useState(ownerId);
  const [resourceType, setResourceType] = useState<'CONSULTATION' | 'TREATMENT_ROOM'>('CONSULTATION');
  const [roomNumber, setRoomNumber] = useState('');
  const [resourceId, setResourceId] = useState('');
  const [notes, setNotes] = useState('');
  const [validationError, setValidationError] = useState('');
  const needsActiveFields = !closedStatuses.has(targetStatus);
  const appointmentExists = Boolean(lead.appointmentAt || lead.appointments?.length);
  const bookingBlocked = targetStatus === 'APPOINTMENT_BOOKED' && !appointmentExists;
  const doctors = staff.filter((member) => member.role === 'DOCTOR' || member.role === 'DR_REVIVE' || member.role === 'ADMIN');
  const activeServices = services.filter((service) => service.active);
  const selectedService = activeServices.find((service) => service.id === serviceId);
  const roomResources = resources.filter((resource) => resource.active && ['ROOM', 'TREATMENT_CHAIR'].includes(resource.type));

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
          roomNumber: resourceType === 'TREATMENT_ROOM' && roomNumber ? Number(roomNumber) : undefined,
          serviceId: serviceId || undefined,
          durationMinutes: selectedService?.durationMinutes ?? 30,
          bufferMinutes: selectedService?.bufferMinutes ?? 0,
          doctorId: doctorId || undefined,
          resourceId: resourceId || undefined,
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
      setValidationError('Owner, next action, and due date are required for an active pipeline stage.');
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

    const payload: MovePayload = { status: targetStatus };
    if (needsActiveFields) {
      payload.ownerId = ownerId;
      payload.nextAction = nextAction.trim();
      payload.nextActionDueAt = new Date(nextActionDueAt).toISOString();
    }
    if (targetStatus === 'QUALIFIED') {
      payload.qualificationNotes = qualificationNotes.trim();
      payload.leadScore = Number(leadScore);
    }
    if (targetStatus === 'LOST') payload.lostReason = reason.trim();
    if (targetStatus === 'DISQUALIFIED') payload.disqualificationReason = reason.trim();
    onConfirm(payload);
  }

  function submitAppointment() {
    setValidationError('');
    if (!appointmentAt) {
      setValidationError('Appointment date and time are required.');
      return;
    }
    if (resourceType === 'TREATMENT_ROOM' && !roomNumber) {
      setValidationError('Select a room for treatment room bookings.');
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
                    <option value="CLINIC_VISIT">Clinic visit</option>
                    <option value="VIDEO_CONSULTATION">Video consultation</option>
                  </Select>
                </Field>
                <Field label="Service">
                  <Select
                    className="w-full"
                    value={serviceId}
                    onChange={(event) => {
                      const service = activeServices.find((item) => item.id === event.target.value);
                      setServiceId(event.target.value);
                      if (service?.resourceType) setResourceType(service.resourceType);
                    }}
                  >
                    <option value="">No service selected</option>
                    {activeServices.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
                  </Select>
                </Field>
                <Field label="Doctor / provider">
                  <Select className="w-full" value={doctorId} onChange={(event) => setDoctorId(event.target.value)}>
                    <option value="">Assign later</option>
                    {(doctors.length ? doctors : staff).map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                  </Select>
                </Field>
                <Field label="Visit purpose">
                  <Select
                    className="w-full"
                    value={resourceType}
                    onChange={(event) => {
                      setResourceType(event.target.value as 'CONSULTATION' | 'TREATMENT_ROOM');
                      setResourceId('');
                    }}
                  >
                    <option value="CONSULTATION">Consultation</option>
                    <option value="TREATMENT_ROOM">Treatment room</option>
                  </Select>
                </Field>
                {resourceType === 'TREATMENT_ROOM' ? (
                  <>
                    <Field label="Treatment room number">
                      <Select className="w-full" value={roomNumber} onChange={(event) => setRoomNumber(event.target.value)}>
                        <option value="">Select room</option>
                        {[1, 2, 3, 4].map((room) => <option key={room} value={room}>Room {room}</option>)}
                      </Select>
                    </Field>
                    {roomResources.length ? (
                      <Field label="Resource name">
                        <Select className="w-full" value={resourceId} onChange={(event) => setResourceId(event.target.value)}>
                          <option value="">Assign resource later</option>
                          {roomResources.map((resource) => <option key={resource.id} value={resource.id}>{resource.name}</option>)}
                        </Select>
                      </Field>
                    ) : null}
                  </>
                ) : null}
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
              {stage.id === 'closed' && (
                <Field label="Closing outcome">
                  <Select
                    className="w-full"
                    value={targetStatus}
                    onChange={(event) => {
                      setTargetStatus(event.target.value as LeadStatus);
                      setValidationError('');
                    }}
                  >
                    <option value="CONVERTED">Won / Converted</option>
                    <option value="LOST">Lost</option>
                    <option value="DISQUALIFIED">Disqualified</option>
                  </Select>
                </Field>
              )}

              {needsActiveFields && (
                <>
                  <Field label="Lead owner">
                    <Select className="w-full" value={ownerId} onChange={(event) => setOwnerId(event.target.value)}>
                      <option value="">Select owner</option>
                      {staff.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                    </Select>
                  </Field>
                  <Field label="Next action">
                    <Input value={nextAction} onChange={(event) => setNextAction(event.target.value)} placeholder="Example: Call to confirm preferred appointment time" />
                  </Field>
                  <Field label="Next action due">
                    <Input type="datetime-local" value={nextActionDueAt} onChange={(event) => setNextActionDueAt(event.target.value)} />
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
                  <Field label="Lead score (0–100)">
                    <Input type="number" min={0} max={100} value={leadScore} onChange={(event) => setLeadScore(event.target.value)} />
                  </Field>
                </>
              )}

              {(targetStatus === 'LOST' || targetStatus === 'DISQUALIFIED') && (
                <Field label={targetStatus === 'LOST' ? 'Lost reason' : 'Disqualification reason'}>
                  <textarea
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    rows={3}
                    placeholder="Add a clear reason for the team"
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}
