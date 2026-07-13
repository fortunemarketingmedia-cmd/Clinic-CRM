import type { Branch } from '@/types/branch';
import type { AdLead } from '@/types/ad-lead';

export type LeadStatus =
  | 'NEW'
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
  branch?: Branch;
  adLeads?: AdLead[];
  patient?: { id: string; patientNo: string; fullName: string } | null;
};

export type TimelineEvent = {
  id: string;
  leadId?: string | null;
  patientId?: string | null;
  type: string;
  title: string;
  description?: string | null;
  createdAt: string;
};
