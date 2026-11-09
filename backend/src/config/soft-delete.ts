// Records an admin deletes are soft deleted: `deletedAt` is set and the row is kept (with a snapshot in the audit log).
// Every top-level read of these models skips soft-deleted rows unless the query filters on `deletedAt` itself.
export const softDeleteModels = new Set([
  'Patient', 'Lead', 'FollowUp', 'Task', 'WaitlistEntry', 'Appointment', 'Session', 'ClinicalEncounter',
  'ProcedureSession', 'PatientFile', 'Invoice', 'Payment', 'TreatmentPackage',
]);
const readOperations = new Set(['findMany', 'findFirst', 'findFirstOrThrow', 'findUnique', 'findUniqueOrThrow', 'count', 'aggregate', 'groupBy']);

// Adds `deletedAt: null` to reads of soft-deletable models, unless the caller filters on `deletedAt` explicitly.
export function withSoftDeleteFilter<T>(model: string | undefined, operation: string, args: T): T {
  if (!model || !softDeleteModels.has(model) || !readOperations.has(operation)) return args;
  const queryArgs = { ...(args ?? {}) } as { where?: Record<string, unknown> };
  if (!queryArgs.where || !('deletedAt' in queryArgs.where)) queryArgs.where = { ...queryArgs.where, deletedAt: null };
  return queryArgs as T;
}
