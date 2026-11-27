type PatientReference = { id: string };

export type AppointmentPatientLinks = {
  lead?: {
    patient?: PatientReference | null;
    person?: {
      patient?: PatientReference | null;
    } | null;
  } | null;
};

export function resolveAppointmentPatientId(appointment: AppointmentPatientLinks) {
  return appointment.lead?.patient?.id ?? appointment.lead?.person?.patient?.id ?? null;
}

export function withResolvedAppointmentPatient<T extends AppointmentPatientLinks>(appointment: T) {
  return {
    ...appointment,
    patientId: resolveAppointmentPatientId(appointment),
  };
}
