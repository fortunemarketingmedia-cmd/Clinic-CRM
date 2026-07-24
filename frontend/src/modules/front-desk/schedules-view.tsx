'use client';

import { useQuery } from '@tanstack/react-query';
import { Building2, CalendarDays, DoorOpen, Stethoscope } from 'lucide-react';
import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { RowsSkeleton } from '@/components/ui/skeleton';
import { apiRequest } from '@/services/api';
import { useSessionStore } from '@/store/session-store';
import type { Appointment, ClinicResource } from '@/types/appointment';
import type { StaffMember } from '@/types/front-desk';

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const time = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

function branchQuery(branchId: string | null) {
  return branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
}

export function SchedulesView() {
  const { session, selectedBranchId } = useSessionStore();
  const isAdmin = session?.user.role === 'ADMIN';
  const canLoad = Boolean(isAdmin || selectedBranchId);
  const allBranches = isAdmin && !selectedBranchId;
  const range = useMemo(() => {
    const dateFrom = new Date();
    dateFrom.setHours(0, 0, 0, 0);
    const dateTo = new Date(dateFrom);
    dateTo.setDate(dateTo.getDate() + 7);
    return { dateFrom, dateTo };
  }, []);

  const staff = useQuery({
    queryKey: ['schedule-staff', selectedBranchId],
    queryFn: () =>
      apiRequest<{ data: StaffMember[] }>(`/front-desk/staff${branchQuery(selectedBranchId)}`),
    enabled: canLoad,
  });
  const resources = useQuery({
    queryKey: ['schedule-resources', selectedBranchId],
    queryFn: () =>
      apiRequest<{ data: ClinicResource[] }>(
        `/front-desk/resources${branchQuery(selectedBranchId)}`,
      ),
    enabled: canLoad,
  });
  const appointments = useQuery({
    queryKey: ['schedule-appointments', selectedBranchId, range.dateFrom, range.dateTo],
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

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Doctors, Rooms & Resources</h1>
          <p className="text-sm text-muted-foreground">
            Weekly availability and bookings across practitioners, rooms, and equipment.
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
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <div className="flex items-center gap-2">
                <Stethoscope className="size-5 text-primary" />
                <h2 className="font-semibold">Practitioner availability</h2>
              </div>
              <div className="mt-4 space-y-3">
                {staff.isLoading ? (
                  <State text="Loading staff…" />
                ) : staff.isError ? (
                  <State text="Staff availability could not be loaded." error />
                ) : (staff.data?.data.length ?? 0) === 0 ? (
                  <State text="No doctors, therapists, or counsellors configured." />
                ) : (
                  staff.data?.data.map((member) => (
                    <div key={member.id} className="rounded-md border p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <span className="font-medium">{member.name}</span>
                          {allBranches ? (
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {member.branchAccess
                                ?.map((access) => access.branch.name)
                                .join(' · ') || 'No branch assignment'}
                            </div>
                          ) : null}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {member.role.replaceAll('_', ' ')}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {member.staffSchedules.length ? (
                          member.staffSchedules.map((schedule) => (
                            <span key={schedule.id} className="rounded bg-muted px-2 py-1 text-xs">
                              {allBranches && schedule.branch ? `${schedule.branch.name} · ` : ''}
                              {weekdays[schedule.weekday]} {time(schedule.startMinutes)}–
                              {time(schedule.endMinutes)}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-amber-600">
                            Availability not configured
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Card>
              <div className="flex items-center gap-2">
                <DoorOpen className="size-5 text-primary" />
                <h2 className="font-semibold">Rooms and equipment</h2>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {resources.isLoading ? (
                  <State text="Loading resources…" />
                ) : resources.isError ? (
                  <State text="Rooms and resources could not be loaded." error />
                ) : (resources.data?.data.length ?? 0) === 0 ? (
                  <State text="No rooms or equipment configured." />
                ) : (
                  resources.data?.data.map((resource) => {
                    const count =
                      appointments.data?.data.filter(
                        (item) =>
                          item.resourceId === resource.id || item.equipmentId === resource.id,
                      ).length ?? 0;
                    return (
                      <div key={resource.id} className="rounded-md border p-3">
                        <div className="font-medium">{resource.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {allBranches && resource.branch ? `${resource.branch.name} · ` : ''}
                          {resource.type.replaceAll('_', ' ')} · {count} bookings this week
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          </div>

          <Card className="overflow-hidden p-0">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <CalendarDays className="size-5 text-primary" />
              <div>
                <h2 className="font-semibold">Next seven days</h2>
                <p className="text-xs text-muted-foreground">
                  {allBranches
                    ? 'Combined booking schedule for every branch'
                    : 'Booking schedule for the selected branch'}
                </p>
              </div>
            </div>
            {appointments.isLoading ? (
              <State text="Loading appointments…" />
            ) : appointments.isError ? (
              <State text="Appointments could not be loaded." error />
            ) : (appointments.data?.data.length ?? 0) === 0 ? (
              <State text="No scheduled appointments." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="px-4 py-3">Date & time</th>
                      {allBranches ? <th className="px-4 py-3">Branch</th> : null}
                      <th className="px-4 py-3">Patient/lead</th>
                      <th className="px-4 py-3">Practitioner</th>
                      <th className="px-4 py-3">Resource</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appointments.data?.data.map((appointment) => (
                      <tr key={appointment.id} className="border-t">
                        <td className="whitespace-nowrap px-4 py-3">
                          {new Date(appointment.appointmentAt).toLocaleString('en-IN')}
                        </td>
                        {allBranches ? (
                          <td className="px-4 py-3">{appointment.branch?.name ?? '—'}</td>
                        ) : null}
                        <td className="px-4 py-3 font-medium">{appointment.lead?.name}</td>
                        <td className="px-4 py-3">
                          {appointment.doctor?.name ?? appointment.therapist?.name ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          {appointment.resource?.name ??
                            appointment.equipment?.name ??
                            (appointment.roomNumber ? `Room ${appointment.roomNumber}` : '—')}
                        </td>
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
