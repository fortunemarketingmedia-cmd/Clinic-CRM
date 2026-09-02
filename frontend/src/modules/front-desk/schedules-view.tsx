'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  DoorOpen,
  Plus,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { RowsSkeleton } from '@/components/ui/skeleton';
import { PatientDirectorySearch } from '@/modules/front-desk/patient-directory-search';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/services/api';
import { useSessionStore } from '@/store/session-store';
import type { Appointment, ClinicResource, ClinicService } from '@/types/appointment';
import type { AppointmentStatus } from '@/types/appointment';
import type { Branch } from '@/types/branch';

function branchQuery(branchId: string | null) {
  return branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
}

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function addMinutes(value: Date, minutes: number) {
  return new Date(value.getTime() + minutes * 60_000);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(value);
}

function formatTimeRange(appointment: Appointment) {
  const start = new Date(appointment.checkInAt ?? appointment.appointmentAt);
  const treatmentEnd = appointment.endAt
    ? new Date(appointment.endAt)
    : addMinutes(start, appointment.durationMinutes);
  const blockedEnd = addMinutes(treatmentEnd, appointment.bufferMinutes ?? 0);
  const formatter = new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${formatter.format(start)} - ${formatter.format(blockedEnd)}`;
}

function busyDurationLabel(appointment: Appointment) {
  const total = appointment.durationMinutes + (appointment.bufferMinutes ?? 0);
  if (!appointment.bufferMinutes) return `${appointment.durationMinutes} min`;
  return `${total} min blocked (${appointment.durationMinutes} min + ${appointment.bufferMinutes} min buffer)`;
}

function appointmentResourceLabel(appointment: Appointment) {
  if (appointment.roomNumber) return `Room ${appointment.roomNumber}`;
  return appointment.resource?.name ?? appointment.equipment?.name ?? 'Consultation';
}

function roomNumberFromName(name: string) {
  const match = name.match(/\b(\d+)\b/);
  return match ? Number(match[1]) : null;
}

function toDateTimeLocal(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

type RoomWorkflowAction = 'CANCELLED' | 'CHECK_IN' | 'CHECKOUT';

function roomActionPayload(action: RoomWorkflowAction) {
  if (action === 'CHECK_IN') return { status: 'CHECKED_IN' as AppointmentStatus };
  if (action === 'CHECKOUT') return { status: 'COMPLETED' as AppointmentStatus };
  return { status: 'CANCELLED' as AppointmentStatus, cancellationReason: 'Cancelled from Schedules & Rooms because the client is not coming' };
}

function roomStatusLabel(appointment: Appointment) {
  if (appointment.status === 'NO_SHOW') return 'EXPIRED';
  if (appointment.status === 'CHECKED_IN') return 'CHECKED IN';
  return appointment.status.replaceAll('_', ' ');
}

export function SchedulesView() {
  const queryClient = useQueryClient();
  const { session, selectedBranchId } = useSessionStore();
  const roomBranchId = selectedBranchId ?? '';
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));
  const [viewMode, setViewMode] = useState<'rooms' | 'calendar'>('rooms');
  const [showRoomBooking, setShowRoomBooking] = useState(false);
  const [reschedulingRoom, setReschedulingRoom] = useState<Appointment | null>(null);

  const branches = useQuery({
    queryKey: ['branches'],
    queryFn: () => apiRequest<{ data: Branch[] }>('/branches'),
    enabled: Boolean(session),
  });
  const roomBranches = useMemo(
    () => branches.data?.data ?? [],
    [branches.data],
  );
  const canLoad = Boolean(session);
  const allRoomBranches = !roomBranchId;
  const allowedRoomBranchIds = useMemo(() => new Set(roomBranches.map((branch) => branch.id)), [roomBranches]);
  const selectedRoomBranch = roomBranches.find((branch) => branch.id === roomBranchId);

  const range = useMemo(() => {
    const dateFrom = startOfDay(selectedDate);
    const dateTo = addDays(dateFrom, 6);
    dateTo.setHours(23, 59, 59, 999);
    return { dateFrom, dateTo };
  }, [selectedDate]);
  const calendarRange = useMemo(() => {
    const monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const dateFrom = addDays(monthStart, -monthStart.getDay());
    const dateTo = addDays(dateFrom, 41);
    dateTo.setHours(23, 59, 59, 999);
    return { dateFrom, dateTo };
  }, [selectedDate]);

  const resources = useQuery({
    queryKey: ['schedule-resources', roomBranchId],
    queryFn: () =>
      apiRequest<{ data: ClinicResource[] }>(
        `/front-desk/resources${branchQuery(roomBranchId || null)}`,
      ),
    enabled: canLoad,
  });

  const appointments = useQuery({
    queryKey: ['schedule-appointments', roomBranchId, calendarRange.dateFrom.toISOString()],
    queryFn: () => {
      const params = new URLSearchParams({
        dateFrom: calendarRange.dateFrom.toISOString(),
        dateTo: calendarRange.dateTo.toISOString(),
      });
      if (roomBranchId) params.set('branchId', roomBranchId);
      return apiRequest<{ data: Appointment[] }>(
        `/front-desk/schedule-appointments?${params.toString()}`,
      );
    },
    enabled: canLoad,
  });

  const allAppointments = useMemo(
    () =>
      [...(appointments.data?.data ?? [])]
        .filter((appointment) => !allRoomBranches || allowedRoomBranchIds.has(appointment.branchId))
        .sort(
          (first, second) =>
            new Date(first.appointmentAt).getTime() - new Date(second.appointmentAt).getTime(),
        ),
    [allRoomBranches, allowedRoomBranchIds, appointments.data],
  );
  const dayKey = localDateKey(selectedDate);
  const dayAppointments = allAppointments.filter(
    (appointment) => localDateKey(new Date(appointment.appointmentAt)) === dayKey,
  );
  const roomBookings = dayAppointments.filter(
    (appointment) => appointment.resourceType === 'TREATMENT_ROOM' && !['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(appointment.status),
  );
  const checkedInRoomAppointments = roomBookings.filter((appointment) => ['CHECKED_IN', 'WAITING', 'IN_CONSULTATION', 'TREATMENT_IN_PROGRESS'].includes(appointment.status));
  const allRoomAppointments = allAppointments.filter(
    (appointment) => appointment.resourceType === 'TREATMENT_ROOM',
  );
  const nextSevenRoomAppointments = allRoomAppointments.filter((appointment) => {
    const startsAt = new Date(appointment.appointmentAt);
    return startsAt >= range.dateFrom && startsAt <= range.dateTo && !['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(appointment.status);
  });
  const configuredRooms = (resources.data?.data ?? []).filter(
    (resource) =>
      resource.active &&
      ['ROOM', 'TREATMENT_CHAIR'].includes(resource.type) &&
      (!allRoomBranches || allowedRoomBranchIds.has(resource.branchId)),
  );
  const occupiedRoomKeys = new Set(
    checkedInRoomAppointments.map((appointment) => appointment.roomNumber ?? appointment.resourceId).filter(Boolean),
  );
  const fallbackRoomCapacity = allRoomBranches ? roomBranches.length * 4 : 4;
  const roomCapacity = configuredRooms.length || fallbackRoomCapacity;
  const displayedRoomBranches = allRoomBranches ? roomBranches : selectedRoomBranch ? [selectedRoomBranch] : roomBranches;
  const metrics = [
    { label: 'Room bookings', value: roomBookings.length },
    { label: 'Rooms occupied', value: occupiedRoomKeys.size },
    { label: 'Rooms available', value: Math.max(roomCapacity - occupiedRoomKeys.size, 0) },
    {
      label: 'Utilisation',
      value: `${roomCapacity ? Math.round((occupiedRoomKeys.size / roomCapacity) * 100) : 0}%`,
    },
  ];

  const updateRoomStatus = useMutation({
    mutationFn: ({ id, action }: { id: string; action: RoomWorkflowAction }) => apiRequest(`/appointments/${id}`, { method: 'PATCH', body: JSON.stringify(roomActionPayload(action)) }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['schedule-appointments'] }),
        queryClient.invalidateQueries({ queryKey: ['appointments'] }),
      ]);
    },
  });

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Schedules & Rooms</h1>
          <p className="text-sm text-muted-foreground">
            Daily treatment-room flow and upcoming bookings.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Building2 className="size-3.5" />Branch: {selectedRoomBranch?.name ?? 'All branches'} (change from the top bar)</p>
          {session?.user.role === 'ADMIN' || session?.user.role === 'RECEPTIONIST' ? <Button type="button" onClick={() => setShowRoomBooking(true)}><Plus className="size-4" />Create appointment</Button> : null}
        </div>
      </div>

      {!canLoad ? (
        <Card className="text-sm text-muted-foreground">Select the clinic branch from the top bar to view room schedules.</Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <Card key={metric.label} className="p-4">
                <div className="text-sm text-muted-foreground">{metric.label}</div>
                <div className="mt-2 text-2xl font-semibold">{metric.value}</div>
              </Card>
            ))}
          </div>

          <PatientDirectorySearch
            branchId={roomBranchId}
            title="Find patient after room treatment"
            description="Search Patient Master after treatment, open the full patient profile, and continue with treatment records, follow-ups, or billing."
          />

          {updateRoomStatus.isError ? <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{updateRoomStatus.error.message}</p> : null}

          <Card className="p-0">
            <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-2">
                <DoorOpen className="mt-0.5 size-5 text-primary" />
                <div>
                  <h2 className="font-semibold">Daily room board</h2>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(selectedDate)} - {selectedRoomBranch?.name ?? 'Nashik Road and Sharanpur Road'} rooms
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant={viewMode === 'rooms' ? 'primary' : 'secondary'} onClick={() => setViewMode('rooms')}>Room board</Button>
                <Button type="button" variant={viewMode === 'calendar' ? 'primary' : 'secondary'} onClick={() => setViewMode('calendar')}>Calendar</Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-10 px-0"
                  aria-label="Previous day"
                  onClick={() => setSelectedDate((date) => addDays(date, -1))}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button type="button" variant="secondary" onClick={() => setSelectedDate(startOfDay(new Date()))}>
                  Today
                </Button>
                <label className="relative">
                  <span className="sr-only">Select room board date</span>
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    aria-label="Select room board date"
                    className="h-10 w-[150px] pl-9 text-sm"
                    type="date"
                    value={localDateKey(selectedDate)}
                    onChange={(event) => {
                      if (event.target.value) setSelectedDate(startOfDay(new Date(`${event.target.value}T00:00:00`)));
                    }}
                  />
                </label>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-10 px-0"
                  aria-label="Next day"
                  onClick={() => setSelectedDate((date) => addDays(date, 1))}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>

            {appointments.isLoading ? (
              <State text="Loading room bookings..." />
            ) : appointments.isError ? (
              <State text="Room bookings could not be loaded." error />
            ) : viewMode === 'rooms' ? (
              <RoomBoard
                appointments={checkedInRoomAppointments}
                configuredRooms={configuredRooms}
                allBranches={allRoomBranches}
                roomBranches={displayedRoomBranches}
                savingId={updateRoomStatus.isPending ? updateRoomStatus.variables?.id : undefined}
                onAction={(appointment, action) => updateRoomStatus.mutate({ id: appointment.id, action })}
                onReschedule={setReschedulingRoom}
              />
            ) : (
              <RoomCalendar
                appointments={allRoomAppointments}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
              />
            )}
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <CalendarDays className="size-5 text-primary" />
              <div>
                <h2 className="font-semibold">Next seven days</h2>
                <p className="text-xs text-muted-foreground">
                  {formatDate(range.dateFrom)} to {formatDate(range.dateTo)}
                </p>
              </div>
            </div>
            {appointments.isLoading ? (
              <State text="Loading appointments..." />
            ) : appointments.isError ? (
              <State text="Appointments could not be loaded." error />
            ) : nextSevenRoomAppointments.length === 0 ? (
              <State text="No scheduled appointments." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="px-4 py-3">Busy time</th>
                      {allRoomBranches ? <th className="px-4 py-3">Branch</th> : null}
                      <th className="px-4 py-3">Client/lead</th>
                      <th className="px-4 py-3">Practitioner</th>
                      <th className="px-4 py-3">Resource</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nextSevenRoomAppointments.map((appointment) => (
                      <tr key={appointment.id} className="border-t border-border">
                        <td className="whitespace-nowrap px-4 py-3">
                          <div className="font-medium">{formatTimeRange(appointment)}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(appointment.appointmentAt).toLocaleDateString('en-IN')} - {busyDurationLabel(appointment)}
                          </div>
                        </td>
                        {allRoomBranches ? (
                          <td className="px-4 py-3">{appointment.branch?.name ?? '-'}</td>
                        ) : null}
                        <td className="px-4 py-3 font-medium">{appointment.lead?.name ?? '-'}</td>
                        <td className="px-4 py-3">
                          {appointment.doctor?.name ?? appointment.therapist?.name ?? '-'}
                        </td>
                        <td className="px-4 py-3">{appointmentResourceLabel(appointment)}</td>
                        <td className="px-4 py-3">{roomStatusLabel(appointment)}</td>
                        <td className="px-4 py-3"><RoomWorkflowActions appointment={appointment} saving={updateRoomStatus.isPending && updateRoomStatus.variables?.id === appointment.id} onAction={(action) => updateRoomStatus.mutate({ id: appointment.id, action })} onReschedule={() => setReschedulingRoom(appointment)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          {showRoomBooking ? (
            <RoomBookingDialog
              branches={roomBranches}
              resources={configuredRooms}
              initialBranchId={roomBranchId || roomBranches[0]?.id || ''}
              initialDate={selectedDate}
              onClose={() => setShowRoomBooking(false)}
              onBooked={async () => {
                setShowRoomBooking(false);
                await Promise.all([
                  queryClient.invalidateQueries({ queryKey: ['schedule-appointments'] }),
                  queryClient.invalidateQueries({ queryKey: ['appointments'] }),
                  queryClient.invalidateQueries({ queryKey: ['daily-client-queue'] }),
                ]);
              }}
            />
          ) : null}
          {reschedulingRoom ? <RoomRescheduleDialog appointment={reschedulingRoom} resources={configuredRooms} onClose={() => setReschedulingRoom(null)} onSaved={async () => { setReschedulingRoom(null); await queryClient.invalidateQueries({ queryKey: ['schedule-appointments'] }); }} /> : null}
        </>
      )}
    </section>
  );
}

type RoomSlot = {
  id: string;
  label: string;
  appointments: Appointment[];
  branch?: string;
  branchId: string;
  roomNumber: number;
};

function RoomBoard({
  appointments,
  configuredRooms,
  allBranches,
  roomBranches,
  savingId,
  onAction,
  onReschedule,
}: {
  appointments: Appointment[];
  configuredRooms: ClinicResource[];
  allBranches: boolean;
  roomBranches: Branch[];
  savingId?: string;
  onAction: (appointment: Appointment, action: RoomWorkflowAction) => void;
  onReschedule: (appointment: Appointment) => void;
}) {
  const configuredBranchIds = new Set(configuredRooms.map((resource) => resource.branchId));
  const fallbackSlots = roomBranches
    .filter((branch) => !configuredBranchIds.has(branch.id))
    .flatMap((branch) =>
      [1, 2, 3, 4].map((roomNumber) => ({
        id: `${branch.id}-room-${roomNumber}`,
        label: `Room ${roomNumber}`,
        appointments: appointments.filter((appointment) => appointment.branchId === branch.id && appointment.roomNumber === roomNumber),
        branch: branch.name,
        branchId: branch.id,
        roomNumber,
      })),
    );
  const slots: RoomSlot[] = [
    ...configuredRooms.map((resource) => ({
      id: resource.id,
      label: resource.name,
      appointments: appointments.filter(
        (appointment) =>
          appointment.resourceId === resource.id ||
          (
            appointment.branchId === resource.branchId &&
            Boolean(appointment.roomNumber) &&
            appointment.roomNumber === roomNumberFromName(resource.name)
          ),
      ),
      branch: resource.branch?.name,
      branchId: resource.branchId,
      roomNumber: roomNumberFromName(resource.name) ?? 1,
    })),
    ...fallbackSlots,
  ];

  return (
    <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
      {slots.map((slot) => (
        <div key={slot.id} className="overflow-hidden rounded-lg border border-border bg-muted/20">
          <div className="flex min-h-14 items-center justify-between gap-2 border-b border-border bg-surface px-3 py-2">
            <div>
              <div className="flex items-center gap-2 font-semibold">
                <DoorOpen className="size-4 text-primary" />
                {slot.label}
              </div>
              {'branch' in slot && allBranches && slot.branch ? (
                <div className="mt-0.5 text-xs text-muted-foreground">{slot.branch}</div>
              ) : null}
            </div>
            <span className="rounded-full bg-muted px-2 py-1 text-xs">{slot.appointments.length}</span>
          </div>
          <div className="min-h-32 space-y-2 p-3">
            {slot.appointments.map((appointment) => (
              <div
                key={appointment.id}
                className={cn(
                  'rounded-md border border-border bg-surface p-3',
                  ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(appointment.status) && 'opacity-65',
                )}
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Clock className="size-4 text-primary" />
                  {formatTimeRange(appointment)}
                </div>
                <div className="mt-1 truncate text-sm">{appointment.lead?.name ?? 'Client'}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {roomStatusLabel(appointment)}
                  {appointment.service?.name ? ` - ${appointment.service.name}` : ''}
                </div>
                <div className="mt-1 text-[11px] font-medium text-muted-foreground">
                  Busy for {busyDurationLabel(appointment)}
                </div>
                <RoomWorkflowActions appointment={appointment} saving={savingId === appointment.id} onAction={(action) => onAction(appointment, action)} onReschedule={() => onReschedule(appointment)} />
              </div>
            ))}
            {!slot.appointments.length ? (
              <div className="grid min-h-24 place-items-center rounded-md border border-dashed border-border px-3 text-center text-xs text-muted-foreground">
                Available
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function RoomWorkflowActions({ appointment, saving, onAction, onReschedule }: { appointment: Appointment; saving: boolean; onAction: (action: RoomWorkflowAction) => void; onReschedule: () => void }) {
  const { session } = useSessionStore();
  const role = session?.user.role;
  const isReceptionist = role === 'RECEPTIONIST';
  const canCheckoutRoom = role === 'ADMIN' || role === 'RECEPTIONIST';
  const awaitingCheckIn = isReceptionist && ['SCHEDULED', 'CONFIRMATION_PENDING', 'CONFIRMED', 'RESCHEDULED'].includes(appointment.status);
  return <div className="mt-3 flex flex-wrap gap-1.5">
    {awaitingCheckIn ? <Button type="button" variant="secondary" className="h-8 px-2 text-xs" onClick={onReschedule}>Reschedule</Button> : null}
    {awaitingCheckIn ? <Button type="button" className="h-8 px-2 text-xs" disabled={saving} onClick={() => onAction('CHECK_IN')}>{saving ? 'Checking in...' : 'Check in'}</Button> : null}
    {awaitingCheckIn ? <Button type="button" variant="secondary" className="h-8 px-2 text-xs" disabled={saving} onClick={() => onAction('CANCELLED')}>Cancel</Button> : null}
    {canCheckoutRoom && ['CHECKED_IN', 'WAITING', 'IN_CONSULTATION', 'TREATMENT_IN_PROGRESS'].includes(appointment.status) ? <Button type="button" className="h-8 px-2 text-xs" disabled={saving} onClick={() => onAction('CHECKOUT')}>{saving ? 'Checking out...' : 'Checkout'}</Button> : null}
  </div>;
}

function RoomRescheduleDialog({ appointment, resources, onClose, onSaved }: { appointment: Appointment; resources: ClinicResource[]; onClose: () => void; onSaved: () => void }) {
  const [appointmentAt, setAppointmentAt] = useState(toDateTimeLocal(appointment.appointmentAt));
  const [roomNumber, setRoomNumber] = useState(String(appointment.roomNumber ?? ''));
  const rooms = resources.filter((resource) => resource.branchId === appointment.branchId);
  const roomNumbers = rooms.length ? rooms.map((resource) => roomNumberFromName(resource.name)).filter((room): room is number => Boolean(room)) : [1, 2, 3, 4];
  const selectedResource = rooms.find((resource) => roomNumberFromName(resource.name) === Number(roomNumber));
  const mutation = useMutation({
    mutationFn: () => apiRequest(`/appointments/${appointment.id}`, { method: 'PATCH', body: JSON.stringify({ appointmentAt: new Date(appointmentAt).toISOString(), resourceType: 'TREATMENT_ROOM', roomNumber: Number(roomNumber), resourceId: selectedResource?.id ?? null, rescheduleReason: 'Rescheduled from Schedules & Rooms' }) }),
    onSuccess: onSaved,
  });
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true"><Card className="w-full max-w-md"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Reschedule room booking</h2><p className="mt-1 text-sm text-muted-foreground">{appointment.lead?.name ?? 'Client'} · Treatment-room workflow</p></div><Button type="button" variant="ghost" onClick={onClose}>Close</Button></div><div className="mt-5 grid gap-4"><label className="space-y-2 text-sm font-medium">New date and time<Input type="datetime-local" value={appointmentAt} onChange={(event) => setAppointmentAt(event.target.value)} /></label><label className="space-y-2 text-sm font-medium">Treatment room<Select value={roomNumber} onChange={(event) => setRoomNumber(event.target.value)}><option value="">Select room</option>{Array.from(new Set(roomNumbers)).sort().map((room) => <option key={room} value={room}>Treatment Room {room}</option>)}</Select></label>{mutation.isError ? <p className="text-sm text-red-700">{mutation.error.message}</p> : null}</div><div className="mt-5 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="button" disabled={!appointmentAt || !roomNumber || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? 'Saving...' : 'Save reschedule'}</Button></div></Card></div>;
}

function RoomCalendar({ appointments, selectedDate, onSelectDate }: { appointments: Appointment[]; selectedDate: Date; onSelectDate: (date: Date) => void }) {
  const monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  const gridStart = addDays(monthStart, -monthStart.getDay());
  const days = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  const grouped = appointments.reduce<Record<string, Appointment[]>>((result, appointment) => {
    const key = localDateKey(new Date(appointment.appointmentAt));
    result[key] = [...(result[key] ?? []), appointment];
    return result;
  }, {});
  return (
    <div className="p-4">
      <div className="grid grid-cols-7 overflow-hidden rounded-lg border border-border text-sm">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <div key={day} className="border-b border-border bg-muted/50 p-2 text-center text-xs font-medium text-muted-foreground">{day}</div>)}
        {days.map((day) => {
          const key = localDateKey(day);
          const bookings = grouped[key] ?? [];
          const selected = key === localDateKey(selectedDate);
          return <button key={key} type="button" onClick={() => onSelectDate(startOfDay(day))} className={cn('min-h-28 border-b border-r border-border p-2 text-left hover:bg-muted/40', day.getMonth() !== selectedDate.getMonth() && 'bg-muted/20 text-muted-foreground', selected && 'bg-primary/10 ring-2 ring-inset ring-primary')}>
            <span className={cn('inline-grid size-7 place-items-center rounded-full text-xs font-semibold', selected && 'bg-primary text-white')}>{day.getDate()}</span>
            <div className="mt-2 space-y-1">{bookings.slice(0, 3).map((item) => <div key={item.id} className="truncate rounded bg-primary/10 px-1.5 py-1 text-[11px] text-primary">{new Date(item.appointmentAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · R{item.roomNumber} · {item.lead?.name ?? 'Client'} · {roomStatusLabel(item)}</div>)}{bookings.length > 3 ? <div className="text-[11px] text-muted-foreground">+{bookings.length - 3} more</div> : null}</div>
          </button>;
        })}
      </div>
    </div>
  );
}

function RoomBookingDialog({ branches, resources, initialBranchId, initialDate, onClose, onBooked }: { branches: Branch[]; resources: ClinicResource[]; initialBranchId: string; initialDate: Date; onClose: () => void; onBooked: () => void }) {
  const [branchId, setBranchId] = useState(initialBranchId);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [source, setSource] = useState('PHONE_CALL');
  const [appointmentAt, setAppointmentAt] = useState(`${localDateKey(initialDate)}T10:00`);
  const [roomNumber, setRoomNumber] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [notes, setNotes] = useState('');
  const services = useQuery({ queryKey: ['room-booking-services', branchId], queryFn: () => apiRequest<{ data: ClinicService[] }>(`/front-desk/services?branchId=${encodeURIComponent(branchId)}`), enabled: Boolean(branchId) });
  const roomServices = (services.data?.data ?? []).filter((service) => service.resourceType === 'TREATMENT_ROOM' && service.active);
  const selectedService = roomServices.find((service) => service.id === serviceId);
  const selectedResource = resources.find((resource) => resource.branchId === branchId && roomNumberFromName(resource.name) === Number(roomNumber));
  const booking = useMutation({
    mutationFn: () => apiRequest('/appointments', { method: 'POST', body: JSON.stringify({ name: name.trim(), mobile: mobile.trim(), source, branchId, appointmentAt, appointmentType: 'CLINIC_VISIT', resourceType: 'TREATMENT_ROOM', roomNumber: Number(roomNumber), resourceId: selectedResource?.id, serviceId: serviceId || undefined, durationMinutes: selectedService?.durationMinutes ?? 30, bufferMinutes: selectedService?.bufferMinutes ?? 0, notes: notes.trim() || undefined, bookingSource: 'SCHEDULES_AND_ROOMS', bookingChannel: 'ROOM_BOARD' }) }),
    onSuccess: onBooked,
  });
  const branchRooms = resources.filter((resource) => resource.branchId === branchId);
  const roomNumbers = branchRooms.length ? branchRooms.map((resource) => roomNumberFromName(resource.name)).filter((room): room is number => Boolean(room)) : [1, 2, 3, 4];
  const valid = branchId && name.trim().length >= 2 && mobile.trim().length >= 8 && appointmentAt && roomNumber;
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="room-booking-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <Card className="mx-auto max-w-3xl">
      <div className="flex items-start justify-between gap-4 border-b border-border pb-4"><div><h2 id="room-booking-title" className="text-xl font-semibold">Book a treatment room</h2><p className="mt-1 text-sm text-muted-foreground">This booking is restricted to treatment rooms and will appear on the room board and calendar.</p></div><Button type="button" variant="secondary" className="w-10 px-0" onClick={onClose} aria-label="Close"><X className="size-4" /></Button></div>
      <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); if (valid) booking.mutate(); }}>
        <label className="space-y-2 text-sm font-medium">Branch<Select value={branchId} onChange={(event) => { setBranchId(event.target.value); setRoomNumber(''); setServiceId(''); }}><option value="">Select branch</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</Select></label>
        <label className="space-y-2 text-sm font-medium">Room<Select value={roomNumber} onChange={(event) => setRoomNumber(event.target.value)}><option value="">Select treatment room</option>{Array.from(new Set(roomNumbers)).sort().map((room) => <option key={room} value={room}>Treatment Room {room}</option>)}</Select></label>
        <label className="space-y-2 text-sm font-medium">Client name<Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" /></label>
        <label className="space-y-2 text-sm font-medium">Mobile<Input value={mobile} onChange={(event) => setMobile(event.target.value)} placeholder="Mobile number" /></label>
        <label className="space-y-2 text-sm font-medium">Date and time<Input type="datetime-local" value={appointmentAt} onChange={(event) => setAppointmentAt(event.target.value)} /></label>
        <label className="space-y-2 text-sm font-medium">Source<Select value={source} onChange={(event) => setSource(event.target.value)}><option value="PHONE_CALL">Phone call</option><option value="WALK_IN">Walk-in</option><option value="WEBSITE">Website</option></Select></label>
        <label className="space-y-2 text-sm font-medium sm:col-span-2">Treatment service<Select value={serviceId} onChange={(event) => setServiceId(event.target.value)}><option value="">General room treatment (30 min)</option>{roomServices.map((service) => <option key={service.id} value={service.id}>{service.name} · {service.durationMinutes} min</option>)}</Select></label>
        <label className="space-y-2 text-sm font-medium sm:col-span-2">Booking notes<Input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Treatment or room preparation notes" /></label>
        {booking.isError ? <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">{booking.error.message}</p> : null}
        <div className="flex gap-2 sm:col-span-2"><Button type="submit" disabled={!valid || booking.isPending}>{booking.isPending ? 'Booking...' : 'Book room appointment'}</Button><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button></div>
      </form>
    </Card>
  </div>;
}

function State({ text, error = false }: { text: string; error?: boolean }) {
  if (text.startsWith('Loading')) return <RowsSkeleton rows={4} />;
  return (
    <p
      className={`col-span-full p-4 text-center text-sm ${error ? 'text-red-600' : 'text-muted-foreground'}`}
    >
      {text}
    </p>
  );
}
