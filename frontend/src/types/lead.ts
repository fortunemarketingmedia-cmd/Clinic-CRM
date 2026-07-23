import type { Branch } from '@/types/branch';
import type { AdLead } from '@/types/ad-lead';

export type LeadStatus =
  | 'NEW'
  | 'UNASSIGNED'
  | 'ASSIGNED'
  | 'ATTEMPTING_CONTACT'
  | 'CONNECTED'
  | 'QUALIFIED'
  | 'APPOINTMENT_PROPOSED'
  | 'APPOINTMENT_BOOKED'
  | 'NURTURING'
  | 'LOST'
  | 'DISQUALIFIED'
  | 'BOOKED'
  | 'CONFIRMED'
  | 'ARRIVED'
  | 'CANCELLED'
  | 'POSTPONED'
  | 'NOT_ARRIVED'
  | 'CONVERTED';

export type LeadPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type Lead = {
  id: string;
  qrToken: string;
  name: string;
  mobile: string;
  email?: string | null;
  address?: string | null;
  source: 'WEBSITE' | 'WALK_IN' | 'PHONE_CALL' | 'WHATSAPP' | 'GOOGLE_ADS' | 'META_ADS';
  status: LeadStatus;
  priority: LeadPriority;
  nextFollowupAt?: string | null;
  lastContactedAt?: string | null;
  followupNotes?: string | null;
  interestedTreatment?: string | null;
  branchId: string;
  appointmentType: 'CLINIC_VISIT' | 'VIDEO_CONSULTATION';
  appointmentAt?: string | null;
  createdAt: string;
  branch?: Branch;
  adLeads?: AdLead[];
  patient?: { id: string; patientNo: string; fullName: string } | null;
  personId?: string | null;
  ownerId?: string | null;
  owner?: { id: string; name: string } | null;
  nextAction?: string | null;
  nextActionDueAt?: string | null;
  leadScore?: number;
  scoreCategory?: 'HOT' | 'WARM' | 'COLD' | 'UNQUALIFIED';
  qualificationNotes?: string | null;
  lostReason?: string | null;
  appointments?: import('@/types/appointment').Appointment[];
  followUps?: import('@/types/foundation').FollowUp[];
  tasks?: import('@/types/foundation').Task[];
  scoreHistory?: LeadScoreHistory[];
};

export type LeadScoreHistory = { id: string; previousScore: number; newScore: number; category: 'HOT' | 'WARM' | 'COLD' | 'UNQUALIFIED'; reasons: Array<{ rule: string; points: number }>; createdAt: string };

export type TimelineEvent = {
  id: string;
  leadId?: string | null;
  patientId?: string | null;
  type: string;
  title: string;
  description?: string | null;
  createdAt: string;
};
