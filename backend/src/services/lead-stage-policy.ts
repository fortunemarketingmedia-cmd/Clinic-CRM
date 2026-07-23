import type { LeadStatus } from '@prisma/client';
import { HttpError } from '../utils/http-error.js';

type LeadState = {
  status: LeadStatus;
  ownerId?: string | null;
  nextAction?: string | null;
  nextActionDueAt?: Date | null;
  appointmentCount: number;
};

type ProposedLeadState = Partial<{
  status: LeadStatus;
  ownerId: string;
  nextAction: string;
  nextActionDueAt: Date;
  appointmentAt: Date;
  qualificationNotes: string;
  leadScore: number;
  lostReason: string;
  disqualificationReason: string;
}>;

const terminalStages: LeadStatus[] = ['CONVERTED', 'LOST', 'DISQUALIFIED'];

export function validateLeadTransition(current: LeadState, proposed: ProposedLeadState) {
  if (proposed.status === 'QUALIFIED' && (!proposed.qualificationNotes || proposed.leadScore === undefined))
    throw new HttpError(400, 'Qualification notes and lead score are required');
  if (proposed.status === 'APPOINTMENT_BOOKED' && current.appointmentCount === 0 && !proposed.appointmentAt)
    throw new HttpError(400, 'A linked appointment is required');
  if (proposed.status === 'LOST' && !proposed.lostReason) throw new HttpError(400, 'Lost reason is required');
  if (proposed.status === 'DISQUALIFIED' && !proposed.disqualificationReason)
    throw new HttpError(400, 'Disqualification reason is required');

  const resultingStatus = proposed.status ?? current.status;
  if (!terminalStages.includes(resultingStatus)) {
    if (!(proposed.ownerId ?? current.ownerId)) throw new HttpError(400, 'Active leads require an owner');
    if (!(proposed.nextAction ?? current.nextAction) || !(proposed.nextActionDueAt ?? current.nextActionDueAt))
      throw new HttpError(400, 'Active leads require a next action and due date');
  }
}

