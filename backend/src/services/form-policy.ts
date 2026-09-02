import type { FormFieldType, Role } from '@prisma/client';
import { Role as RoleEnum } from '@prisma/client';
import { HttpError } from '../utils/http-error.js';

export type SnapshotField = { key: string; label: string; type: FormFieldType; required: boolean; hidden: boolean; readOnly: boolean; condition?: { field: string; operator: 'EQUALS' | 'NOT_EQUALS' | 'CONTAINS'; value: unknown } };

function conditionMatches(field: SnapshotField, values: Record<string, unknown>) {
  if (!field.condition) return true;
  const actual = values[field.condition.field];
  if (field.condition.operator === 'EQUALS') return actual === field.condition.value;
  if (field.condition.operator === 'NOT_EQUALS') return actual !== field.condition.value;
  return String(actual ?? '').includes(String(field.condition.value ?? ''));
}

export function validateSubmission(fields: SnapshotField[], values: Record<string, unknown>) {
  for (const field of fields) {
    if (field.hidden || field.readOnly || !field.required || !conditionMatches(field, values)) continue;
    const value = values[field.key];
    if (value === undefined || value === null || value === '' || value === false || (Array.isArray(value) && value.length === 0)) {
      throw new HttpError(400, `${field.label} is required`);
    }
  }
}

const clinicalFileRoles: Role[] = [RoleEnum.ADMIN];
const adminFileRoles: Role[] = [RoleEnum.ADMIN, RoleEnum.RECEPTIONIST];

export function canAccessFile(role: Role, visibility: 'CLINICAL_ONLY' | 'CARE_TEAM' | 'ADMINISTRATIVE' | 'PATIENT_VISIBLE') {
  if (visibility === 'CLINICAL_ONLY' || visibility === 'CARE_TEAM') return clinicalFileRoles.includes(role);
  if (visibility === 'ADMINISTRATIVE') return adminFileRoles.includes(role);
  return clinicalFileRoles.includes(role) || adminFileRoles.includes(role);
}
