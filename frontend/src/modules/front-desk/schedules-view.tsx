'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  DoorOpen,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RowsSkeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/services/api';
import { useSessionStore } from '@/store/session-store';
import type { Appointment, ClinicResource } from '@/types/appointment';

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

function formatDate(value: Date) {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(value);
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function appointmentResourceLabel(appointment: Appointment) {
  if (appointment.roomNumber) return `Room ${appointment.roomNumber}`;
  return appointment.resource?.name ?? appointment.equipment?.name ?? 'Consultation';
}

export function SchedulesView() {
  const { session, selectedBranchId } = useSessionStore();
  const isAdmin = session?.user.role === 'ADMIN';
  const canLoad = Boolean(isAdmin || selectedBranchId);
  const allBranches = isAdmin && !selectedBranchId;
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));

  const range = useMemo(() => {
    const dateFrom = startOfDay(selectedDate);
    const dateTo = addDays(dateFrom, 6);
    dateTo.setHours(23, 59, 59, 999);
    return { dateFrom, dateTo };
  }, [selectedDate]);

  const resources = useQuery({
    queryKey: ['schedule-resources', selectedBranchId],
    queryFn: () =>
      apiRequest<{ data: ClinicResource[] }>(
        `/front-desk/resources${branchQuery(selectedBranchId)}`,
      ),
    enabled: canLoad,
  });

  const appointments = useQuery({
    queryKey: ['schedule-appointments', selectedBranchId, range.dateFrom.toISOString()],
    queryFn: () => {
      const params = new URLSearchParams({
        dateFrom: range.dateFrom.toISOString(),
        dateTo: range.dateTo.toISOString(),
      });
      if (selectedBranchId) params.set('branchId', selectedBranchId);
      return apiRequest<{ data: Appointment[] }>(
        `/front-desk/schedule-appointments?${params.toString()}`,
      );
    },
    enabled: canLoad,
  });

  const allAppointments = useMemo(
    () =>
      [...(appointments.data?.data ?? [])].sort(
        (first, second) =>
          new Date(first.appointmentAt).getTime() - new Date(second.appointmentAt).getTime(),
      ),
    [appointments.data],
  );
  const dayKey = localDateKey(selectedDate);
  const dayAppointments = allAppointments.filter(
    (appointment) => localDateKey(new Date(appointment.appointmentAt)) === dayKey,
  );
  const roomAppointments = dayAppointments.filter(
    (appointment) => appointment.resourceType === 'TREATMENT_ROOM',
  );
  const configuredRooms = (resources.data?.data ?? []).filter(
    (resource) => resource.active && ['ROOM', 'TREATMENT_CHAIR'].includes(resource.type),
  );
  const occupiedRoomKeys = new Set(
    roomAppointments.map((appointment) => appointment.roomNumber ?? appointment.resourceId).filter(Boolean),
  );
  const roomCapacity = Math.max(4, configuredRooms.length);
  const metrics = [
    { label: 'Room bookings', value: roomAppointments.length },
    { label: 'Rooms occupied', value: occupiedRoomKeys.size },
    { label: 'Rooms available', value: Math.max(roomCapacity - occupiedRoomKeys.size, 0) },
    {
      label: 'Utilisation',
      value: `${roomCapacity ? Math.round((occupiedRoomKeys.size / roomCapacity) * 100) : 0}%`,
    },
  ];

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Schedules & Rooms</h1>
          <p className="text-sm text-muted-foreground">
            Daily treatment-room flow and upcoming bookings.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-medium">
          <Building2 className="size-4 text-primary" />
          {allBranches ? 'All branches' : 'Selected branch'}
        </span>
      </div>

      {!canLoad ? (
        <Card className="text-sm text-muted-foreground">Select a branch to view schedules.</Card>
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

          <Card className="p-0">
            <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-2">
                <DoorOpen className="mt-0.5 size-5 text-primary" />
                <div>
                  <h2 className="font-semibold">Daily room board</h2>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(selectedDate)} · treatment rooms and room-linked appointments
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
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
            ) : (
              <RoomBoard
                appointments={roomAppointments}
                configuredRooms={configuredRooms}
                allBranches={allBranches}
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
            ) : allAppointments.length === 0 ? (
              <State text="No scheduled appointments." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="px-4 py-3">Date & time</th>
                      {allBranches ? <th className="px-4 py-3">Branch</th> : null}
                      <th className="px-4 py-3">Client/lead</th>
                      <th className="px-4 py-3">Practitioner</th>
                      <th className="px-4 py-3">Resource</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allAppointments.map((appointment) => (
                      <tr key={appointment.id} className="border-t border-border">
                        <td className="whitespace-nowrap px-4 py-3">
                          {new Date(appointment.appointmentAt).toLocaleString('en-IN')}
                        </td>
                        {allBranches ? (
                          <td className="px-4 py-3">{appointment.branch?.name ?? '-'}</td>
                        ) : null}
                        <td className="px-4 py-3 font-medium">{appointment.lead?.name ?? '-'}</td>
                        <td className="px-4 py-3">
                          {appointment.doctor?.name ?? appointment.therapist?.name ?? '-'}
                        </td>
                        <td className="px-4 py-3">{appointmentResourceLabel(appointment)}</td>
                        <td className="px-4 py-3">{appointment.status.replaceAll('_', ' ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
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
};

function RoomBoard({
  appointments,
  configuredRooms,
  allBranches,
}: {
  appointments: Appointment[];
  configuredRooms: ClinicResource[];
  allBranches: boolean;
}) {
  const slots: RoomSlot[] = [
    ...[1, 2, 3, 4].map((roomNumber) => ({
      id: `room-${roomNumber}`,
      label: `Room ${roomNumber}`,
      appointments: appointments.filter((appointment) => appointment.roomNumber === roomNumber),
    })),
    ...configuredRooms.map((resource) => ({
      id: resource.id,
      label: resource.name,
      appointments: appointments.filter(
        (appointment) => appointment.resourceId === resource.id && !appointment.roomNumber,
      ),
      branch: resource.branch?.name,
    })),
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
                  {formatTime(appointment.appointmentAt)}
                </div>
                <div className="mt-1 truncate text-sm">{appointment.lead?.name ?? 'Client'}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {appointment.status.replaceAll('_', ' ')}
                  {appointment.service?.name ? ` · ${appointment.service.name}` : ''}
                </div>
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
