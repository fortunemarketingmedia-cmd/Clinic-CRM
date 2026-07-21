import type { Branch } from '@/types/branch';
import type { Lead, LeadStatus } from '@/types/lead';

export type Appointment = {
  id: string;
  leadId: string;
  branchId: string;
  appointmentAt: string;
  appointmentType: 'CLINIC_VISIT' | 'VIDEO_CONSULTATION';
  resourceType: 'CONSULTATION' | 'TREATMENT_ROOM';
  roomNumber?: number | null;
  status: LeadStatus;
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
