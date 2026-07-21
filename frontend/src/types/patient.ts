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
  createdAt: string;
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
  keloidOrHypertrophicScar?: string | null;
  productsCurrentlyUsed?: string | null;
  menstrualHistory?: string | null;
  pregnancyStatus?: string | null;
  notes?: string | null;
};

export type PatientSession = {
  id: string;
  appointmentId?: string | null;
  treatmentType: 'CONSULTATION' | 'VIDEO_CONSULTATION' | 'TREATMENT_ROOM' | 'PROCEDURE' | 'FOLLOW_UP' | 'OTHER';
  visitDate: string;
  doctorConsulted?: string | null;
  chiefComplaint?: string | null;
  diagnosis?: string | null;
  treatmentSuggested?: string | null;
  treatmentTaken?: string | null;
  medicinesPrescribed?: string | null;
  prescription?: PrescriptionMedicine[] | null;
  notes?: string | null;
  followupDate?: string | null;
  package?: TreatmentPackage | null;
  files?: PatientFile[];
};

export type PrescriptionMedicine = {
  medicine: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
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
