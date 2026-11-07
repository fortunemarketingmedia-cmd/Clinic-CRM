'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { DeleteRecordButton, EditButton, EditRecordDialog, fromLocalInput, toDateTimeInput } from '@/components/ui/record-actions';
import { apiRequest } from '@/services/api';
import type { Appointment } from '@/types/appointment';
import type { ClinicResource, ClinicService, StaffMember } from '@/types/front-desk';

const when = (value: string) => new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

/** Edit (date & time, duration, notes) and admin Delete for one appointment. */
export function AppointmentRecordActions({ appointment, canEdit, onChanged, name, className }: { appointment: Appointment; canEdit: boolean; onChanged?: () => void; name?: string; className?: string }) {
  const [editing, setEditing] = useState(false);
  const branchId = appointment.branchId;
  const servicesQuery = useQuery({ queryKey: ['appointment-edit-services', branchId], queryFn: () => apiRequest<{ data: ClinicService[] }>(`/front-desk/services?branchId=${encodeURIComponent(branchId)}`), enabled: editing });
  const resourcesQuery = useQuery({ queryKey: ['appointment-edit-resources', branchId], queryFn: () => apiRequest<{ data: ClinicResource[] }>(`/front-desk/resources?branchId=${encodeURIComponent(branchId)}`), enabled: editing });
  const staffQuery = useQuery({ queryKey: ['appointment-edit-staff', branchId], queryFn: () => apiRequest<{ data: StaffMember[] }>(`/front-desk/staff?branchId=${encodeURIComponent(branchId)}`), enabled: editing });
  const services = servicesQuery.data?.data ?? [];
  const resources = resourcesQuery.data?.data ?? [];
  const staff = staffQuery.data?.data ?? [];
  const label = `${name ?? appointment.lead?.patient?.fullName ?? appointment.lead?.name ?? 'Appointment'} · ${when(appointment.appointmentAt)}`;
  return <div className={className ?? 'flex flex-wrap items-center gap-1.5'} onClick={(event) => event.stopPropagation()}>
    {canEdit ? <EditButton onClick={() => setEditing(true)} /> : null}
    <DeleteRecordButton kind="appointment" id={appointment.id} what="appointment" name={label} onDeleted={onChanged} />
    {editing ? <EditRecordDialog
      title="Edit appointment"
      subtitle={label}
      wide
      initial={{ appointmentAt: toDateTimeInput(appointment.appointmentAt), appointmentType: appointment.appointmentType, resourceType: appointment.resourceType, roomNumber: appointment.roomNumber != null ? String(appointment.roomNumber) : '', serviceId: appointment.serviceId ?? '', durationMinutes: String(appointment.durationMinutes ?? 30), bufferMinutes: String(appointment.bufferMinutes ?? 0), doctorId: appointment.doctorId ?? '', therapistId: appointment.therapistId ?? '', counsellorId: appointment.counsellorId ?? '', resourceId: appointment.resourceId ?? '', equipmentId: appointment.equipmentId ?? '', notes: appointment.notes ?? '', rescheduleReason: '' }}
      fields={[
        { name: 'appointmentAt', label: 'Date & time', type: 'datetime', required: true },
        { name: 'appointmentType', label: 'Appointment type', type: 'select', required: true, options: [{ value: 'CLINIC_VISIT', label: 'Clinic visit' }, { value: 'VIDEO_CONSULTATION', label: 'Video consultation' }] },
        { name: 'resourceType', label: 'Visit area', type: 'select', required: true, options: [{ value: 'CONSULTATION', label: 'Consultation' }, { value: 'TREATMENT_ROOM', label: 'Treatment room' }] },
        { name: 'roomNumber', label: 'Room number', type: 'select', options: [1, 2, 3, 4].map((value) => ({ value: String(value), label: `Room ${value}` })) },
        { name: 'serviceId', label: 'Service', type: 'select', options: services.map((service) => ({ value: service.id, label: service.name })) },
        { name: 'durationMinutes', label: 'Duration (minutes)', type: 'number', min: 5, required: true },
        { name: 'bufferMinutes', label: 'Buffer (minutes)', type: 'number', min: 0, required: true },
        { name: 'doctorId', label: 'Doctor', type: 'select', options: staff.map((member) => ({ value: member.id, label: member.name })) },
        { name: 'therapistId', label: 'Therapist', type: 'select', options: staff.map((member) => ({ value: member.id, label: member.name })) },
        { name: 'counsellorId', label: 'Counsellor', type: 'select', options: staff.map((member) => ({ value: member.id, label: member.name })) },
        { name: 'resourceId', label: 'Room / chair resource', type: 'select', options: resources.filter((item) => item.type !== 'EQUIPMENT').map((item) => ({ value: item.id, label: item.name })) },
        { name: 'equipmentId', label: 'Equipment', type: 'select', options: resources.filter((item) => item.type === 'EQUIPMENT').map((item) => ({ value: item.id, label: item.name })) },
        { name: 'rescheduleReason', label: 'Reason for change', placeholder: 'e.g. Patient asked for a later slot', hint: 'Only needed when the date or time changes.' },
        { name: 'notes', label: 'Notes', type: 'textarea' },
      ]}
      onSubmit={(values) => {
        const appointmentAt = fromLocalInput(values.appointmentAt);
        const moved = appointmentAt && new Date(appointmentAt).getTime() !== new Date(appointment.appointmentAt).getTime();
        return apiRequest(`/appointments/${appointment.id}`, { method: 'PATCH', body: JSON.stringify({
          appointmentAt: moved ? appointmentAt : undefined,
          appointmentType: values.appointmentType,
          resourceType: values.resourceType,
          roomNumber: values.roomNumber ? Number(values.roomNumber) : null,
          serviceId: values.serviceId || null,
          durationMinutes: Number(values.durationMinutes) || undefined,
          bufferMinutes: Number(values.bufferMinutes),
          doctorId: values.doctorId || null,
          therapistId: values.therapistId || null,
          counsellorId: values.counsellorId || null,
          resourceId: values.resourceId || null,
          equipmentId: values.equipmentId || null,
          notes: values.notes,
          rescheduleReason: moved && values.rescheduleReason.trim() ? values.rescheduleReason.trim() : undefined,
        }) });
      }}
      onClose={() => setEditing(false)}
      onSaved={onChanged}
    /> : null}
  </div>;
}
