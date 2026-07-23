import type { Appointment } from '@/types/appointment';
import type { MedicalProfile, Patient, PatientFile, TreatmentPackage } from '@/types/patient';

export type Clinician = { id: string; name: string; role?: string };
export type MedicalProfileVersion = { id: string; previousValue?: Record<string, unknown>; updatedValue: Record<string, unknown>; reason?: string | null; createdAt: string; updatedBy?: Clinician | null };
export type ClinicalEncounter = {
  id: string; type: string; status: 'DRAFT' | 'COMPLETED' | 'SIGNED' | 'LOCKED' | 'ADDENDUM_ADDED'; visitDate: string;
  chiefComplaint?: string | null; history?: string | null; examination?: string | null; assessment?: string | null; diagnosis?: string | null;
  treatmentAdvised?: string | null; procedurePerformed?: string | null; followUpPlan?: string | null; clinicalNotes?: string | null;
  doctor: Clinician; therapist?: Clinician | null; signedBy?: Clinician | null; signedAt?: string | null;
  addendums: Array<{ id: string; content: string; createdAt: string; author: Clinician }>;
};
export type TreatmentPlanItem = { id: string; name: string; plannedSessions: number; completedSessions: number; frequency?: string | null; estimatedAmount?: string | null; practitioner?: Clinician | null };
export type TreatmentPlan = { id: string; concern: string; diagnosis?: string | null; goals?: string | null; status: string; patientAcceptance: string; consentStatus: string; estimatedCost?: string | null; reviewDate?: string | null; assignedDoctor: Clinician; assignedTherapist?: Clinician | null; items: TreatmentPlanItem[]; createdAt: string };
export type ProcedureSession = { id: string; procedureName: string; treatmentArea?: string | null; status: string; consentVerified: boolean; adverseEventFlag: boolean; performedAt?: string | null; practitioner: Clinician; room?: { name: string } | null; device?: { name: string } | null; procedureNotes?: string | null; postCareInstructions?: string | null; createdAt: string };
export type PrescriptionItem = { id: string; medicineName: string; strength?: string | null; dosage: string; frequency: string; duration: string; route?: string | null; timing?: string | null; instructions?: string | null };
export type ClinicalPrescription = { id: string; prescriptionNo: string; prescribedAt: string; diagnosisSummary?: string | null; status: 'DRAFT' | 'SIGNED' | 'CANCELLED'; doctor: Clinician; signedBy?: Clinician | null; items: PrescriptionItem[] };
export type Patient360 = Patient & {
  primaryConcern?: string | null;
  assignedDoctor?: Clinician | null;
  person?: { marketingConsent: boolean; transactionalConsent: boolean; appointmentNotificationConsent: boolean; dataProcessingConsent: boolean } | null;
  medicalProfile?: (MedicalProfile & { clinicalAlerts?: string | null; criticalAlert?: boolean; surgicalHistory?: string | null; productAllergies?: string | null; foodAllergies?: string | null; familyHistory?: string | null; smokingStatus?: string | null; alcoholHistory?: string | null; versions?: MedicalProfileVersion[] }) | null;
  lead: NonNullable<Patient['lead']> & { appointments: Appointment[] };
  clinicalEncounters?: ClinicalEncounter[];
  treatmentPlans?: TreatmentPlan[];
  procedureSessions?: ProcedureSession[];
  prescriptions?: ClinicalPrescription[];
  packages: TreatmentPackage[];
  invoices: Array<{ id: string; invoiceNo: string; totalAmount: string; status: string; invoiceDate: string; payments: Array<{ id: string; amount: string; paidAt: string }> }>;
  files: PatientFile[];
  timelineEvents: Array<{ id: string; type: string; title: string; description?: string | null; createdAt: string }>;
  summary: { outstandingAmount: number; sessionsRemaining: number; activeTreatmentPlan?: TreatmentPlan | null; lastVisit?: Appointment | null; nextAppointment?: Appointment | null };
};

export type DoctorWorkspace = { consultations: Appointment[]; waitingPatients: Appointment[]; incompleteNotes: Array<ClinicalEncounter & { patient: Patient }>; plansForReview: Array<TreatmentPlan & { patient: Patient }>; alerts: Patient[]; followUpsDue: Array<{ id: string; dueAt: string; activityType: string; patient?: Patient | null }>; prescriptionActions: Array<ClinicalPrescription & { patient: Patient }>; adverseEvents: Array<ProcedureSession & { patient: Patient }> };
