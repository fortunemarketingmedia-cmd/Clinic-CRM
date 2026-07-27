'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock,
  RotateCcw,
  Search,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PageSkeleton } from '@/components/ui/skeleton';
import { apiRequest } from '@/services/api';
import { useSessionStore } from '@/store/session-store';
import type { Appointment, ClinicResource, ClinicService } from '@/types/appointment';
import type { StaffMember } from '@/types/front-desk';
import type { Branch } from '@/types/branch';
import type { AppointmentStatus } from '@/types/appointment';

const appointmentStatuses: Array<{ label: string; value: AppointmentStatus }> = [
  { label: 'Requested', value: 'REQUESTED' },
  { label: 'Slot proposed', value: 'SLOT_PROPOSED' },
  { label: 'Scheduled', value: 'SCHEDULED' },
  { label: 'Confirmation pending', value: 'CONFIRMATION_PENDING' },
  { label: 'Confirmed', value: 'CONFIRMED' },
  { label: 'Checked in', value: 'CHECKED_IN' },
  { label: 'Waiting', value: 'WAITING' },
  { label: 'In consultation', value: 'IN_CONSULTATION' },
  { label: 'Treatment in progress', value: 'TREATMENT_IN_PROGRESS' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Rescheduled', value: 'RESCHEDULED' },
  { label: 'No show', value: 'NO_SHOW' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

function quickStatuses(status: AppointmentStatus) {
  const allowed: Partial<Record<AppointmentStatus, AppointmentStatus[]>> = {
    REQUESTED: ['SLOT_PROPOSED', 'SCHEDULED'],
    SLOT_PROPOSED: ['SCHEDULED'],
    SCHEDULED: ['CONFIRMATION_PENDING', 'CONFIRMED', 'CHECKED_IN'],
    CONFIRMATION_PENDING: ['CONFIRMED', 'CHECKED_IN'],
    CONFIRMED: ['CHECKED_IN'],
    CHECKED_IN: ['WAITING', 'IN_CONSULTATION'],
    WAITING: ['IN_CONSULTATION'],
    IN_CONSULTATION: ['TREATMENT_IN_PROGRESS', 'COMPLETED'],
    TREATMENT_IN_PROGRESS: ['COMPLETED'],
    RESCHEDULED: ['SCHEDULED', 'CONFIRMED'],
  };
  return appointmentStatuses.filter(
    (item) => item.value === status || allowed[status]?.includes(item.value),
  );
}

const appointmentSchema = z
  .object({
    name: z.string().min(2, 'Name is required'),
    mobile: z.string().min(8, 'Mobile number is required'),
    address: z.string().optional(),
    source: z.string().min(1, 'Source is required'),
    branchId: z.string().min(1, 'Branch is required'),
    appointmentAt: z.string().min(1, 'Appointment time is required'),
    appointmentType: z.enum(['CLINIC_VISIT', 'VIDEO_CONSULTATION']),
    resourceType: z.enum(['CONSULTATION', 'TREATMENT_ROOM']),
    roomNumber: z.coerce.number().int().min(1).max(4).optional(),
    notes: z.string().optional(),
    serviceId: z.string().optional(),
    durationMinutes: z.coerce.number().int().min(5).max(480).optional(),
    bufferMinutes: z.coerce.number().int().min(0).max(120).optional(),
    doctorId: z.string().optional(),
    therapistId: z.string().optional(),
    resourceId: z.string().optional(),
    equipmentId: z.string().optional(),
  })
  .refine((value) => value.resourceType !== 'TREATMENT_ROOM' || Boolean(value.roomNumber), {
    message: 'Select a treatment room',
    path: ['roomNumber'],
  });

type AppointmentFormValues = z.infer<typeof appointmentSchema>;

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(
    new Date(value),
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00`));
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}`;
}

function monthRange(monthDate: Date) {
  return {
    start: new Date(monthDate.getFullYear(), monthDate.getMonth(), 1),
    end: new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0),
  };
}

function buildMonthDays(monthDate: Date) {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function statusClass(status: AppointmentStatus) {
  if (status === 'CHECKED_IN' || status === 'COMPLETED') return 'bg-emerald-50 text-emerald-700';
  if (status === 'NO_SHOW' || status === 'CANCELLED') return 'bg-red-50 text-red-700';
  if (status === 'RESCHEDULED') return 'bg-amber-50 text-amber-700';
  return 'bg-primary/10 text-primary';
}

export function AppointmentsView() {
  const queryClient = useQueryClient();
  const { session, selectedBranchId, setSelectedBranchId } = useSessionStore();
  const isAdmin = session?.user.role === 'ADMIN';
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(localDateKey(new Date()));
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<AppointmentStatus | ''>('');
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [viewMode, setViewMode] = useState<'calendar' | 'day' | 'list'>('calendar');

  const branchesQuery = useQuery({
    queryKey: ['branches'],
    queryFn: () => apiRequest<{ data: Branch[] }>('/branches'),
  });

  const branches = branchesQuery.data?.data ?? [];
  const activeBranchId = isAdmin
    ? (selectedBranchId ?? '')
    : selectedBranchId || branches[0]?.id || '';
  const servicesQuery = useQuery({
    queryKey: ['appointment-services', activeBranchId],
    queryFn: () =>
      apiRequest<{ data: ClinicService[] }>(
        `/front-desk/services${activeBranchId ? `?branchId=${activeBranchId}` : ''}`,
      ),
    enabled: Boolean(isAdmin || activeBranchId),
  });
  const resourcesQuery = useQuery({
    queryKey: ['appointment-resources', activeBranchId],
    queryFn: () =>
      apiRequest<{ data: ClinicResource[] }>(
        `/front-desk/resources${activeBranchId ? `?branchId=${activeBranchId}` : ''}`,
      ),
    enabled: Boolean(isAdmin || activeBranchId),
  });
  const staffQuery = useQuery({
    queryKey: ['appointment-staff', activeBranchId],
    queryFn: () =>
      apiRequest<{ data: StaffMember[] }>(
        `/front-desk/staff${activeBranchId ? `?branchId=${activeBranchId}` : ''}`,
      ),
    enabled: Boolean(isAdmin || activeBranchId),
  });

  useEffect(() => {
    if (!branches.length) return;
    if (isAdmin && selectedBranchId === null) {
      setSelectedBranchId('');
      return;
    }
    if (
      !isAdmin &&
      (!selectedBranchId || !branches.some((branch) => branch.id === selectedBranchId))
    ) {
      setSelectedBranchId(branches[0].id);
    }
  }, [branches, isAdmin, selectedBranchId, setSelectedBranchId]);

  const range = useMemo(() => monthRange(calendarMonth), [calendarMonth]);
  const appointmentQueryString = useMemo(() => {
    const params = new URLSearchParams();
    if (!isAdmin || activeBranchId) params.set('branchId', activeBranchId);
    if (status) params.set('status', status);
    if (search.trim()) params.set('search', search.trim());
    params.set('dateFrom', new Date(`${localDateKey(range.start)}T00:00:00`).toISOString());
    params.set('dateTo', new Date(`${localDateKey(range.end)}T23:59:59`).toISOString());
    return params.toString();
  }, [activeBranchId, isAdmin, range.end, range.start, search, status]);

  const appointmentsQuery = useQuery({
    queryKey: ['appointments', appointmentQueryString],
    queryFn: () => apiRequest<{ data: Appointment[] }>(`/appointments?${appointmentQueryString}`),
    enabled: Boolean(isAdmin || activeBranchId),
  });

  const appointments = useMemo(
    () =>
      [...(appointmentsQuery.data?.data ?? [])].sort(
        (first, second) =>
          new Date(first.appointmentAt).getTime() - new Date(second.appointmentAt).getTime(),
      ),
    [appointmentsQuery.data],
  );

  const monthDays = useMemo(() => buildMonthDays(calendarMonth), [calendarMonth]);
  const appointmentsByDate = useMemo(() => {
    return appointments.reduce<Record<string, Appointment[]>>((groups, appointment) => {
      const key = localDateKey(new Date(appointment.appointmentAt));
      groups[key] = [...(groups[key] ?? []), appointment];
      return groups;
    }, {});
  }, [appointments]);

  const selectedDayAppointments = appointmentsByDate[selectedDate] ?? [];
  const selectedDateLabel = formatDate(selectedDate);
  const appointmentCounts = {
    total: appointments.length,
    confirmed: appointments.filter((appointment) => appointment.status === 'CONFIRMED').length,
    arrived: appointments.filter((appointment) => appointment.status === 'CHECKED_IN').length,
    pending: appointments.filter((appointment) =>
      ['RESCHEDULED', 'NO_SHOW'].includes(appointment.status),
    ).length,
  };
  const defaultMetrics = [
    { label: 'This month', value: appointmentCounts.total },
    { label: 'Confirmed', value: appointmentCounts.confirmed },
    { label: 'Arrived', value: appointmentCounts.arrived },
    { label: 'Action needed', value: appointmentCounts.pending },
  ];

  const form = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      name: '',
      mobile: '',
      address: '',
      source: '',
      branchId: activeBranchId,
      appointmentAt: '',
      appointmentType: 'CLINIC_VISIT',
      resourceType: 'CONSULTATION',
      roomNumber: undefined,
      notes: '',
      serviceId: '',
      durationMinutes: 30,
      bufferMinutes: 0,
      doctorId: '',
      therapistId: '',
      resourceId: '',
      equipmentId: '',
    },
  });

  useEffect(() => {
    if (!editingAppointment && activeBranchId) form.setValue('branchId', activeBranchId);
  }, [activeBranchId, editingAppointment, form]);

  const createAppointment = useMutation({
    mutationFn: (values: AppointmentFormValues) =>
      apiRequest<{ data: Appointment }>('/appointments', {
        method: 'POST',
        body: JSON.stringify({
          ...values,
          notes: values.notes || undefined,
          serviceId: values.serviceId || undefined,
          doctorId: values.doctorId || undefined,
          therapistId: values.therapistId || undefined,
          resourceId: values.resourceId || undefined,
          equipmentId: values.equipmentId || undefined,
        }),
      }),
    onSuccess: () => {
      form.reset({
        name: '',
        mobile: '',
        address: '',
        source: '',
        branchId: activeBranchId,
        appointmentAt: '',
        appointmentType: 'CLINIC_VISIT',
        resourceType: 'CONSULTATION',
        roomNumber: undefined,
        notes: '',
        serviceId: '',
        durationMinutes: 30,
        bufferMinutes: 0,
        doctorId: '',
        therapistId: '',
        resourceId: '',
        equipmentId: '',
      });
      setShowAppointmentForm(false);
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
    },
  });

  const updateAppointment = useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id: string;
      values: Omit<
        Partial<AppointmentFormValues>,
        'roomNumber' | 'serviceId' | 'doctorId' | 'therapistId' | 'resourceId' | 'equipmentId'
      > & {
        status?: AppointmentStatus;
        roomNumber?: number | null;
        serviceId?: string | null;
        doctorId?: string | null;
        therapistId?: string | null;
        resourceId?: string | null;
        equipmentId?: string | null;
      };
    }) =>
      apiRequest<{ data: Appointment }>(`/appointments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(values),
      }),
    onSuccess: () => {
      setEditingAppointment(null);
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
    },
  });

  function startEdit(appointment: Appointment) {
    setEditingAppointment(appointment);
    setShowAppointmentForm(true);
    form.reset({
      name: appointment.lead?.name ?? '',
      mobile: appointment.lead?.mobile ?? '',
      address: appointment.lead?.address ?? '',
      source:
        appointment.lead?.source === 'WHATSAPP'
          ? 'PHONE_CALL'
          : (appointment.lead?.source ?? 'PHONE_CALL'),
      branchId: appointment.branchId,
      appointmentAt: toDateTimeLocal(appointment.appointmentAt),
      appointmentType: appointment.appointmentType,
      resourceType: appointment.resourceType ?? 'CONSULTATION',
      roomNumber: appointment.roomNumber ?? undefined,
      notes: appointment.notes ?? '',
      serviceId: appointment.serviceId ?? '',
      durationMinutes: appointment.durationMinutes ?? 30,
      bufferMinutes: appointment.bufferMinutes ?? 0,
      doctorId: appointment.doctorId ?? '',
      therapistId: appointment.therapistId ?? '',
      resourceId: appointment.resourceId ?? '',
      equipmentId: appointment.equipmentId ?? '',
    });
  }

  function onSubmit(values: AppointmentFormValues) {
    if (editingAppointment) {
      updateAppointment.mutate({
        id: editingAppointment.id,
        values: {
          branchId: values.branchId,
          appointmentAt: values.appointmentAt,
          appointmentType: values.appointmentType,
          resourceType: values.resourceType,
          roomNumber: values.resourceType === 'TREATMENT_ROOM' ? values.roomNumber : null,
          notes: values.notes || undefined,
          serviceId: values.serviceId || null,
          durationMinutes: values.durationMinutes,
          bufferMinutes: values.bufferMinutes,
          doctorId: values.doctorId || null,
          therapistId: values.therapistId || null,
          resourceId: values.resourceId || null,
          equipmentId: values.equipmentId || null,
        },
      });
      return;
    }
    createAppointment.mutate(values);
  }

  if (appointmentsQuery.isLoading) return <PageSkeleton />;

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Appointments</h1>
          <p className="text-sm text-muted-foreground">
            Universal clinic calendar with time-wise daily schedule.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button type="button" onClick={() => setShowAppointmentForm(true)}>
            <CalendarClock className="size-4" />
            Create New Appointment
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {defaultMetrics.map((metric) => (
          <AppointmentMetric key={metric.label} label={metric.label} value={metric.value} />
        ))}
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold">
              {viewMode === 'calendar'
                ? 'Universal Calendar'
                : viewMode === 'day'
                  ? 'Day Schedule'
                  : 'List View'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(
                calendarMonth,
              )}{' '}
              ·{' '}
              {activeBranchId
                ? branches.find((branch) => branch.id === activeBranchId)?.name
                : 'All branches'}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant={viewMode === 'calendar' ? 'primary' : 'secondary'}
              onClick={() => setViewMode('calendar')}
            >
              Calendar
            </Button>
            <Button
              type="button"
              variant={viewMode === 'day' ? 'primary' : 'secondary'}
              onClick={() => setViewMode('day')}
            >
              Day schedule
            </Button>
            <Button
              type="button"
              variant={viewMode === 'list' ? 'primary' : 'secondary'}
              onClick={() => setViewMode('list')}
            >
              List
            </Button>
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
              onChange={(event) => setStatus(event.target.value as AppointmentStatus | '')}
            >
              <option value="">All statuses</option>
              {appointmentStatuses.map((appointmentStatus) => (
                <option key={appointmentStatus.value} value={appointmentStatus.value}>
                  {appointmentStatus.label}
                </option>
              ))}
            </Select>
            <Button
              type="button"
              variant="secondary"
              className="w-10 px-0"
              aria-label="Previous month"
              onClick={() =>
                setCalendarMonth(
                  new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1),
                )
              }
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const today = new Date();
                setCalendarMonth(today);
                setSelectedDate(localDateKey(today));
              }}
            >
              Current date
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-10 px-0"
              aria-label="Next month"
              onClick={() =>
                setCalendarMonth(
                  new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1),
                )
              }
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        {viewMode === 'calendar' ? (
          <div className="mt-4 grid grid-cols-7 overflow-hidden rounded-md border border-border text-sm">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div
                key={day}
                className="border-b border-border bg-muted px-2 py-2 text-center text-xs font-medium text-muted-foreground"
              >
                {day}
              </div>
            ))}
            {monthDays.map((day) => {
              const key = localDateKey(day);
              const dayAppointments = appointmentsByDate[key] ?? [];
              const isCurrentMonth = monthKey(day) === monthKey(calendarMonth);
              const isToday = key === localDateKey(new Date());
              const isSelected = key === selectedDate;

              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={isSelected}
                  aria-label={`${formatDate(key)}${isToday ? ', today' : ''}${isSelected ? ', selected' : ''}`}
                  className={[
                    'relative min-h-32 border-b border-r border-border p-2 text-left transition hover:bg-muted/60',
                    !isCurrentMonth ? 'bg-muted/30 text-muted-foreground' : 'bg-surface',
                    isToday && !isSelected ? 'bg-amber-50/70 ring-1 ring-inset ring-amber-400' : '',
                    isSelected ? '!bg-primary/10 ring-2 ring-inset ring-primary shadow-sm' : '',
                  ].join(' ')}
                  onClick={() => setSelectedDate(key)}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span
                      className={[
                        'inline-flex size-7 items-center justify-center rounded-full text-xs font-semibold',
                        isSelected ? 'bg-primary text-white' : '',
                        isToday && !isSelected ? 'bg-amber-500 text-white' : '',
                      ].join(' ')}
                    >
                      {day.getDate()}
                    </span>
                    <div className="flex items-center gap-1">
                      {isToday ? (
                        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                          Today
                        </span>
                      ) : null}
                      {dayAppointments.length ? (
                        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px]">
                          {dayAppointments.length}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="space-y-1">
                    {dayAppointments.slice(0, 4).map((appointment) => (
                      <div
                        key={appointment.id}
                        className={`truncate rounded-md px-2 py-1 text-xs ${statusClass(appointment.status)}`}
                      >
                        {formatTime(appointment.appointmentAt)} {appointment.lead?.name}
                        {appointment.resourceType === 'TREATMENT_ROOM'
                          ? ` · R${appointment.roomNumber}`
                          : ''}
                      </div>
                    ))}
                    {dayAppointments.length > 4 ? (
                      <div className="text-xs text-muted-foreground">
                        +{dayAppointments.length - 4} more
                      </div>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        ) : null}

        {viewMode === 'day' ? (
          <AppointmentList
            appointments={selectedDayAppointments}
            onSelect={setSelectedAppointment}
            onEdit={startEdit}
            onStatusChange={(appointment, nextStatus) =>
              updateAppointment.mutate({ id: appointment.id, values: { status: nextStatus } })
            }
          />
        ) : null}
        {viewMode === 'list' ? (
          <AppointmentList
            appointments={appointments}
            onSelect={setSelectedAppointment}
            onEdit={startEdit}
            onStatusChange={(appointment, nextStatus) =>
              updateAppointment.mutate({ id: appointment.id, values: { status: nextStatus } })
            }
          />
        ) : null}
      </Card>

      {viewMode === 'calendar' ? (
        <Card>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold">Schedule for {selectedDateLabel}</h2>
              <p className="text-sm text-muted-foreground">
                All appointments for the selected day, sorted by time.
              </p>
            </div>
            <span className="text-sm text-muted-foreground">
              {selectedDayAppointments.length} appointments
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {selectedDayAppointments.map((appointment) => (
              <div
                key={appointment.id}
                className="grid cursor-pointer gap-3 rounded-md border border-border p-3 hover:bg-muted/50 lg:grid-cols-[90px_1fr_180px_180px] lg:items-center"
                onClick={() => setSelectedAppointment(appointment)}
              >
                <div className="flex items-center gap-2 font-semibold">
                  <Clock className="size-4 text-primary" />
                  {formatTime(appointment.appointmentAt)}
                </div>
                <div>
                  <div className="font-medium">{appointment.lead?.name ?? 'Patient'}</div>
                  <div className="text-xs text-muted-foreground">
                    {appointment.lead?.mobile} · {appointment.branch?.name} ·{' '}
                    {appointment.lead?.source?.replace('_', ' ')}
                  </div>
                </div>
                <Select
                  aria-label="Appointment status"
                  value={appointment.status}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) =>
                    updateAppointment.mutate({
                      id: appointment.id,
                      values: { status: event.target.value as AppointmentStatus },
                    })
                  }
                >
                  {quickStatuses(appointment.status).map((appointmentStatus) => (
                    <option key={appointmentStatus.value} value={appointmentStatus.value}>
                      {appointmentStatus.label}
                    </option>
                  ))}
                  {!appointmentStatuses.some(
                    (appointmentStatus) => appointmentStatus.value === appointment.status,
                  ) ? (
                    <option value={appointment.status}>
                      {appointment.status.replace('_', ' ')}
                    </option>
                  ) : null}
                </Select>
                <div className="flex gap-2" onClick={(event) => event.stopPropagation()}>
                  <Button type="button" variant="secondary" onClick={() => startEdit(appointment)}>
                    <RotateCcw className="size-4" />
                    Reschedule
                  </Button>
                </div>
              </div>
            ))}
            {!appointmentsQuery.isLoading && selectedDayAppointments.length === 0 ? (
              <div className="rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                No appointments on this date.
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}

      {selectedAppointment ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/30 p-4">
          <Card className="mx-auto max-w-3xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">
                  {selectedAppointment.lead?.name ?? 'Appointment'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {formatDate(localDateKey(new Date(selectedAppointment.appointmentAt)))} ·{' '}
                  {formatTime(selectedAppointment.appointmentAt)}
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setSelectedAppointment(null)}
              >
                Close
              </Button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <AppointmentDetail label="Mobile" value={selectedAppointment.lead?.mobile ?? '-'} />
              <AppointmentDetail label="Branch" value={selectedAppointment.branch?.name ?? '-'} />
              <AppointmentDetail
                label="Status"
                value={selectedAppointment.status.replace('_', ' ')}
              />
              <AppointmentDetail
                label="Type"
                value={selectedAppointment.appointmentType.replace('_', ' ')}
              />
              <AppointmentDetail
                label="Resource"
                value={
                  selectedAppointment.resourceType === 'TREATMENT_ROOM'
                    ? `Treatment room ${selectedAppointment.roomNumber}`
                    : 'Consultation'
                }
              />
              <AppointmentDetail
                label="Source"
                value={selectedAppointment.lead?.source?.replace('_', ' ') ?? '-'}
              />
              <AppointmentDetail label="Notes" value={selectedAppointment.notes ?? '-'} />
            </div>
            <div className="mt-5 flex gap-2">
              <Button type="button" onClick={() => startEdit(selectedAppointment)}>
                <RotateCcw className="size-4" />
                Reschedule
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      {showAppointmentForm || editingAppointment ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/30 p-4">
          <Card className="mx-auto max-w-5xl">
            <h2 className="text-base font-semibold">
              {editingAppointment ? 'Reschedule Appointment' : 'Create New Appointment'}
            </h2>
            <form className="mt-5 grid gap-5 lg:grid-cols-3" onSubmit={form.handleSubmit(onSubmit)}>
              <label className="block space-y-2">
                <span className="text-sm font-medium">Source</span>
                <Select {...form.register('source')} disabled={Boolean(editingAppointment)}>
                  <option value="">None selected</option>
                  <option value="PHONE_CALL">Call</option>
                  <option value="WEBSITE">Website</option>
                  <option value="WALK_IN">Walk-in</option>
                </Select>
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium">Visit purpose</span>
                <Select {...form.register('resourceType')}>
                  <option value="CONSULTATION">Consultation</option>
                  <option value="TREATMENT_ROOM">Treatment / room booking</option>
                </Select>
              </label>
              {form.watch('resourceType') === 'TREATMENT_ROOM' ? (
                <label className="block space-y-2">
                  <span className="text-sm font-medium">Treatment room</span>
                  <Select {...form.register('roomNumber')}>
                    <option value="">Select room</option>
                    {[1, 2, 3, 4].map((room) => (
                      <option key={room} value={room}>
                        Room {room}
                      </option>
                    ))}
                  </Select>
                  {form.formState.errors.roomNumber ? (
                    <span className="text-xs text-red-600">
                      {form.formState.errors.roomNumber.message}
                    </span>
                  ) : null}
                </label>
              ) : null}
              <label className="block space-y-2">
                <span className="text-sm font-medium">Service</span>
                <Select
                  {...form.register('serviceId')}
                  onChange={(event) => {
                    const service = servicesQuery.data?.data.find(
                      (item) => item.id === event.target.value,
                    );
                    form.setValue('serviceId', event.target.value);
                    if (service) {
                      form.setValue('durationMinutes', service.durationMinutes);
                      form.setValue('bufferMinutes', service.bufferMinutes);
                      form.setValue('resourceType', service.resourceType);
                    }
                  }}
                >
                  <option value="">Default consultation</option>
                  {servicesQuery.data?.data.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} · {service.durationMinutes} min
                    </option>
                  ))}
                </Select>
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium">Duration (minutes)</span>
                <Input type="number" {...form.register('durationMinutes')} />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium">Buffer (minutes)</span>
                <Input type="number" {...form.register('bufferMinutes')} />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium">Doctor</span>
                <Select {...form.register('doctorId')}>
                  <option value="">No doctor assigned</option>
                  {staffQuery.data?.data
                    .filter((staff) => staff.role === 'ADMIN')
                    .map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.name}
                      </option>
                    ))}
                </Select>
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium">Therapist</span>
                <Select {...form.register('therapistId')}>
                  <option value="">No therapist assigned</option>
                  {staffQuery.data?.data
                    .filter((staff) => staff.role === 'RECEPTIONIST')
                    .map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.name}
                      </option>
                    ))}
                </Select>
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium">Room / chair</span>
                <Select {...form.register('resourceId')}>
                  <option value="">No configured resource</option>
                  {resourcesQuery.data?.data
                    .filter((resource) => resource.type !== 'EQUIPMENT')
                    .map((resource) => (
                      <option key={resource.id} value={resource.id}>
                        {resource.name}
                      </option>
                    ))}
                </Select>
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium">Equipment</span>
                <Select {...form.register('equipmentId')}>
                  <option value="">No equipment</option>
                  {resourcesQuery.data?.data
                    .filter((resource) => resource.type === 'EQUIPMENT')
                    .map((resource) => (
                      <option key={resource.id} value={resource.id}>
                        {resource.name}
                      </option>
                    ))}
                </Select>
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium">Patient name</span>
                <Input
                  placeholder="Full name"
                  {...form.register('name')}
                  disabled={Boolean(editingAppointment)}
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium">Mobile</span>
                <Input
                  placeholder="Mobile number"
                  {...form.register('mobile')}
                  disabled={Boolean(editingAppointment)}
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium">Address</span>
                <Input
                  placeholder="Address"
                  {...form.register('address')}
                  disabled={Boolean(editingAppointment)}
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium">Branch</span>
                <Select {...form.register('branchId')}>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium">Type</span>
                <Select {...form.register('appointmentType')}>
                  <option value="CLINIC_VISIT">Clinic visit</option>
                  <option value="VIDEO_CONSULTATION">Video consultation</option>
                </Select>
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium">Date and time</span>
                <Input type="datetime-local" {...form.register('appointmentAt')} />
              </label>
              <label className="block space-y-2 lg:col-span-2">
                <span className="text-sm font-medium">Notes</span>
                <Input {...form.register('notes')} />
              </label>
              {createAppointment.error || updateAppointment.error ? (
                <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 lg:col-span-3">
                  {createAppointment.error?.message ?? updateAppointment.error?.message}
                </div>
              ) : null}
              <div className="flex gap-3 lg:col-span-3">
                <Button
                  type="submit"
                  disabled={createAppointment.isPending || updateAppointment.isPending}
                >
                  <CalendarClock className="size-4" />
                  {editingAppointment ? 'Save Changes' : 'Schedule'}
                </Button>
                {editingAppointment ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setEditingAppointment(null);
                      setShowAppointmentForm(false);
                      form.reset({
                        name: '',
                        mobile: '',
                        address: '',
                        source: '',
                        branchId: activeBranchId,
                        appointmentAt: '',
                        appointmentType: 'CLINIC_VISIT',
                        resourceType: 'CONSULTATION',
                        roomNumber: undefined,
                        notes: '',
                        serviceId: '',
                        durationMinutes: 30,
                        bufferMinutes: 0,
                        doctorId: '',
                        therapistId: '',
                        resourceId: '',
                        equipmentId: '',
                      });
                    }}
                  >
                    Cancel
                  </Button>
                ) : null}
                {!editingAppointment ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowAppointmentForm(false);
                      form.reset({
                        name: '',
                        mobile: '',
                        address: '',
                        source: '',
                        branchId: activeBranchId,
                        appointmentAt: '',
                        appointmentType: 'CLINIC_VISIT',
                        resourceType: 'CONSULTATION',
                        roomNumber: undefined,
                        notes: '',
                        serviceId: '',
                        durationMinutes: 30,
                        bufferMinutes: 0,
                        doctorId: '',
                        therapistId: '',
                        resourceId: '',
                        equipmentId: '',
                      });
                    }}
                  >
                    Close
                  </Button>
                ) : null}
              </div>
            </form>
          </Card>
        </div>
      ) : null}
    </section>
  );
}

function AppointmentMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </Card>
  );
}

function AppointmentList({
  appointments,
  onSelect,
  onEdit,
  onStatusChange,
}: {
  appointments: Appointment[];
  onSelect: (appointment: Appointment) => void;
  onEdit: (appointment: Appointment) => void;
  onStatusChange: (appointment: Appointment, status: AppointmentStatus) => void;
}) {
  return (
    <div className="mt-4 space-y-3">
      {appointments.map((appointment) => (
        <div
          key={appointment.id}
          className="grid cursor-pointer gap-3 rounded-md border border-border p-3 hover:bg-muted/50 lg:grid-cols-[90px_1fr_180px_180px] lg:items-center"
          onClick={() => onSelect(appointment)}
        >
          <div className="flex items-center gap-2 font-semibold">
            <Clock className="size-4 text-primary" />
            {formatTime(appointment.appointmentAt)}
          </div>
          <div>
            <div className="font-medium">{appointment.lead?.name ?? 'Patient'}</div>
            <div className="text-xs text-muted-foreground">
              {appointment.lead?.mobile} · {appointment.branch?.name} ·{' '}
              {appointment.lead?.source?.replace('_', ' ')}
              {appointment.resourceType === 'TREATMENT_ROOM'
                ? ` · Room ${appointment.roomNumber}`
                : ' · Consultation'}
            </div>
          </div>
          <Select
            aria-label="Appointment status"
            value={appointment.status}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) =>
              onStatusChange(appointment, event.target.value as AppointmentStatus)
            }
          >
            {quickStatuses(appointment.status).map((appointmentStatus) => (
              <option key={appointmentStatus.value} value={appointmentStatus.value}>
                {appointmentStatus.label}
              </option>
            ))}
            {!appointmentStatuses.some(
              (appointmentStatus) => appointmentStatus.value === appointment.status,
            ) ? (
              <option value={appointment.status}>{appointment.status.replace('_', ' ')}</option>
            ) : null}
          </Select>
          <div className="flex gap-2" onClick={(event) => event.stopPropagation()}>
            <Button type="button" variant="secondary" onClick={() => onEdit(appointment)}>
              <RotateCcw className="size-4" />
              Reschedule
            </Button>
          </div>
        </div>
      ))}
      {!appointments.length ? (
        <div className="rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          No appointments found.
        </div>
      ) : null}
    </div>
  );
}

function AppointmentDetail({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}
