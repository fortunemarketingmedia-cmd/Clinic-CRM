import type { Branch } from '@/types/branch';
import type { Lead } from '@/types/lead';

export type AppointmentStatus =
  | 'REQUESTED'
  | 'SLOT_PROPOSED'
  | 'SCHEDULED'
  | 'CONFIRMATION_PENDING'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'WAITING'
  | 'IN_CONSULTATION'
  | 'TREATMENT_IN_PROGRESS'
  | 'BILLING_PENDING'
  | 'COMPLETED'
  | 'RESCHEDULED'
  | 'CANCELLED'
  | 'NO_SHOW';

export type Appointment = {
  id: string;
  leadId: string;
  branchId: string;
  appointmentAt: string;
  endAt?: string | null;
  durationMinutes: number;
  bufferMinutes: number;
  appointmentType: 'CLINIC_VISIT' | 'VIDEO_CONSULTATION';
  resourceType: 'CONSULTATION' | 'TREATMENT_ROOM';
  roomNumber?: number | null;
  serviceId?: string | null;
  doctorId?: string | null;
  therapistId?: string | null;
  resourceId?: string | null;
  equipmentId?: string | null;
  service?: ClinicService | null;
  doctor?: { id: string; name: string } | null;
  therapist?: { id: string; name: string } | null;
  resource?: ClinicResource | null;
  equipment?: ClinicResource | null;
  status: AppointmentStatus;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  branch?: Branch;
  lead?: Lead & {
    patient?: {
      id: string;
      patientNo: string;
      fullName: string;
      qrToken: string;
    } | null;
  };
};

export type ClinicService = {
  id: string;
  branchId?: string | null;
  name: string;
  category?: string | null;
  durationMinutes: number;
  bufferMinutes: number;
  basePrice?: string | number | null;
  resourceType: 'CONSULTATION' | 'TREATMENT_ROOM';
  active: boolean;
};
export type ClinicResource = {
  id: string;
  branchId: string;
  name: string;
  type: 'ROOM' | 'EQUIPMENT' | 'TREATMENT_CHAIR' | 'OTHER';
  serialNumber?: string | null;
  active: boolean;
  branch?: Branch;
};
