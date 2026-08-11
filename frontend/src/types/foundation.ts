import type { Branch } from '@/types/branch';
import type { Lead } from '@/types/lead';

export type WorkStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'OVERDUE';
export type WorkPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type Person = { id: string; fullName: string; primaryMobile: string; email?: string | null };
export type FollowUp = { id: string; activityType: string; channel: string; dueAt: string; reminderAt?: string | null; completedAt?: string | null; status: WorkStatus; priority: WorkPriority; outcome?: string | null; notes?: string | null; nextAction?: string | null; nextFollowUpAt?: string | null; person: Person; lead?: Lead | null; branch: Branch; assignedUser: { id: string; name: string } };
export type Task = { id: string; title: string; description?: string | null; type: string; dueAt: string; reminderAt?: string | null; completionNotes?: string | null; status: WorkStatus; priority: WorkPriority; person?: Person | null; lead?: Lead | null; branch: Branch; assignedUser: { id: string; name: string } };
