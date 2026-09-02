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
  registeredAt?: string | null;
  registrationSource?: string | null;
  status?: string | null;
  primaryConcern?: string | null;
  lastVisitAt?: string | null;
  nextVisitAt?: string | null;
  createdAt: string;
  updatedAt?: string | null;
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
  surgicalHistory?: string | null;
  productAllergies?: string | null;
  foodAllergies?: string | null;
  previousAestheticProcedures?: string | null;
  breastfeedingStatus?: string | null;
  familyHistory?: string | null;
  smokingStatus?: string | null;
  alcoholHistory?: string | null;
  clinicalAlerts?: string | null;
  criticalAlert?: boolean;
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
  packageId?: string | null;
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
  outstandingAmount?: string;
  status?: string;
  purchaseDate?: string;
  startDate?: string;
  expiryDate?: string;
};

export type PatientFile = {
  id: string;
  category: 'IMAGE' | 'PRESCRIPTION' | 'REPORT' | 'INVOICE' | 'OTHER';
  name: string;
  url: string;
  createdAt: string;
};
