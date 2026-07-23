import type { Appointment, ClinicResource, ClinicService } from '@/types/appointment';
import type { Person, WorkPriority } from '@/types/foundation';

export type QueueStage =
  'EXPECTED' | 'ARRIVED' | 'WAITING' | 'WITH_DOCTOR' | 'TREATMENT' | 'BILLING' | 'COMPLETED';
export type QueueAppointment = Appointment & { queueStage: QueueStage };
export type StaffSchedule = {
  id: string;
  userId: string;
  branchId: string;
  weekday: number;
  startMinutes: number;
  endMinutes: number;
  user: { id: string; name: string; role: string };
  branch?: { id: string; name: string };
};
export type StaffMember = {
  id: string;
  name: string;
  role: string;
  staffSchedules: StaffSchedule[];
  branchAccess?: Array<{ branch: { id: string; name: string } }>;
};
export type WaitlistEntry = {
  id: string;
  personId: string;
  branchId: string;
  requestedService: string;
  preferredFrom: string;
  preferredTo: string;
  priority: WorkPriority;
  status: 'ACTIVE' | 'NOTIFIED' | 'ACCEPTED' | 'DECLINED' | 'BOOKED' | 'EXPIRED' | 'CANCELLED';
  notes?: string | null;
  person: Person;
  service?: ClinicService | null;
  preferredDoctor?: { id: string; name: string } | null;
  appointment?: Appointment | null;
};
export type { ClinicResource, ClinicService };
