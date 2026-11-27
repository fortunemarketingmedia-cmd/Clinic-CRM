import type { Appointment } from '@/types/appointment';

export function resolveAppointmentPatientId(appointment: Appointment) {
  return appointment.lead?.patient?.id
    ?? appointment.lead?.person?.patient?.id
    ?? appointment.patientId
    ?? null;
}
