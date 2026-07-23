import type { Request, Response } from 'express';
import { personService } from '../services/person.service.js';
import { duplicatePersonQuerySchema, mergePersonSchema, personFieldsSchema, personQuerySchema } from '../validations/person.validation.js';

function auditContext(req: Request) {
  return { userId: req.user?.id, ipAddress: req.ip, device: req.header('user-agent'), correlationId: req.correlationId };
}

export const personController = {
  async list(req: Request, res: Response) { res.json({ data: await personService.list(personQuerySchema.parse(req.query)) }); },
  async get(req: Request, res: Response) { res.json({ data: await personService.get(req.params.id) }); },
  async duplicates(req: Request, res: Response) { res.json({ data: await personService.findDuplicates(duplicatePersonQuerySchema.parse(req.query)) }); },
  async create(req: Request, res: Response) {
    const data = await personService.create(personFieldsSchema.parse(req.body), auditContext(req));
    res.status(201).json({ data });
  },
  async merge(req: Request, res: Response) {
    const input = mergePersonSchema.parse(req.body);
    res.json({ data: await personService.merge(req.params.id, input.duplicatePersonId, auditContext(req)) });
  },
};

