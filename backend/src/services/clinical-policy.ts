import type { EncounterStatus, TreatmentPlanStatus } from '@prisma/client';
import { HttpError } from '../utils/http-error.js';

const editableEncounterStatuses: EncounterStatus[] = ['DRAFT', 'COMPLETED'];

export function assertEncounterEditable(status: EncounterStatus) {
  if (!editableEncounterStatuses.includes(status)) {
    throw new HttpError(409, 'Signed clinical notes are locked; create an addendum instead');
  }
}

export function assertEncounterSignable(status: EncounterStatus) {
  if (!editableEncounterStatuses.includes(status)) {
    throw new HttpError(409, 'Only draft or completed encounters can be signed');
  }
}

const planTransitions: Record<TreatmentPlanStatus, TreatmentPlanStatus[]> = {
  DRAFT: ['PROPOSED', 'CANCELLED'],
  PROPOSED: ['ACCEPTED', 'DRAFT', 'CANCELLED'],
  ACCEPTED: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['ON_HOLD', 'COMPLETED', 'CANCELLED'],
  ON_HOLD: ['ACTIVE', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function assertTreatmentPlanTransition(from: TreatmentPlanStatus, to: TreatmentPlanStatus) {
  if (from === to) return;
  if (!planTransitions[from].includes(to)) {
    throw new HttpError(409, `Treatment plan cannot move from ${from} to ${to}`);
  }
}
