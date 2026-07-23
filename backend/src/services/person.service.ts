import { personRepository, type PersonInput } from '../repositories/person.repository.js';
import { auditService, type AuditContext } from './audit.service.js';
import { HttpError } from '../utils/http-error.js';
import { normalizeEmail, normalizeMobile } from '../utils/identity.js';

function normalized(input: Omit<PersonInput, 'normalizedMobile' | 'normalizedEmail' | 'normalizedAlternateMobile'>): PersonInput {
  return {
    ...input,
    normalizedMobile: normalizeMobile(input.primaryMobile),
    normalizedEmail: normalizeEmail(input.email),
    normalizedAlternateMobile: input.alternateMobile ? normalizeMobile(input.alternateMobile) : undefined,
  };
}

export const personService = {
  list: personRepository.list,

  async get(id: string) {
    const person = await personRepository.findById(id);
    if (!person) throw new HttpError(404, 'Person not found');
    return person;
  },

  findDuplicates(input: { mobile?: string; email?: string }) {
    return personRepository.findExact({
      normalizedMobile: input.mobile ? normalizeMobile(input.mobile) : undefined,
      normalizedEmail: normalizeEmail(input.email),
    });
  },

  async findOrCreate(input: Omit<PersonInput, 'normalizedMobile' | 'normalizedEmail' | 'normalizedAlternateMobile'>) {
    const data = normalized(input);
    const existing = await personRepository.findExact(data);
    return existing ?? personRepository.create(data);
  },

  async create(input: Omit<PersonInput, 'normalizedMobile' | 'normalizedEmail' | 'normalizedAlternateMobile'>, audit: AuditContext) {
    const data = normalized(input);
    const existing = await personRepository.findExact(data);
    if (existing) throw new HttpError(409, `A matching person already exists (${existing.id})`);
    const person = await personRepository.create(data);
    await auditService.record(audit, { action: 'PERSON_CREATED', entity: 'Person', entityId: person.id });
    return person;
  },

  async merge(primaryId: string, duplicateId: string, audit: AuditContext) {
    if (primaryId === duplicateId) throw new HttpError(400, 'Primary and duplicate must be different people');
    const result = await personRepository.merge(primaryId, duplicateId);
    if (!result) throw new HttpError(404, 'Person not found');
    if (result.conflict) throw new HttpError(409, 'Both people have patient profiles; clinical review is required before merging');
    await auditService.record(audit, {
      action: 'PERSON_MERGED', entity: 'Person', entityId: primaryId,
      newValue: { duplicatePersonId: duplicateId },
    });
    return this.get(primaryId);
  },
};
