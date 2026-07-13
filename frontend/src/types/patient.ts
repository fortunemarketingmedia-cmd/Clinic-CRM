import type { Branch } from '@/types/branch';
import type { Lead } from '@/types/lead';

export type Patient = {
  id: string;
  patientNo: string;
  qrToken: string;
  leadId: string;
  branchId: string;
  fullName: string;
  mobile: string;
  email?: string | null;
  age?: number | null;
  sex?: 'MALE' | 'FEMALE' | 'OTHER' | null;
  address?: string | null;
  occupation?: string | null;
  maritalStatus?: string | null;
  branch?: Branch;
  lead?: Lead;
  medicalProfile?: MedicalProfile | null;
};

export type MedicalProfile = {
  id: string;
  patientId: string;
  referredBy?: string | null;
  skinConcern?: string | null;
  hairConcern?: string | null;
  medicalHistory?: string | null;
  currentMedications?: string | null;
  allergyToDrugs?: string | null;
  notes?: string | null;
};

export type PatientSession = {
  id: string;
  visitDate: string;
  doctorConsulted?: string | null;
  treatmentSuggested?: string | null;
  treatmentTaken?: string | null;
  medicinesPrescribed?: string | null;
  notes?: string | null;
  followupDate?: string | null;
};

export type TreatmentPackage = {
  id: string;
  name: string;
  totalSessions: number;
  completedSessions: number;
  amount: string;
  paidAmount: string;
};

export type PatientFile = {
  id: string;
  category: 'IMAGE' | 'PRESCRIPTION' | 'REPORT' | 'INVOICE' | 'OTHER';
  name: string;
  url: string;
  createdAt: string;
};
