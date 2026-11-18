import { prisma } from '../config/db.js';
import { HttpError } from '../utils/http-error.js';
import { accessService } from '../services/access.service.js';
import type { Request, Response } from 'express';
import { personService } from '../services/person.service.js';
import { duplicatePersonQuerySchema, mergePersonSchema, personFieldsSchema, personQuerySchema } from '../validations/person.validation.js';

function auditContext(req: Request) {
  return { userId: req.user?.id, ipAddress: req.ip, device: req.header('user-agent'), correlationId: req.correlationId };
}

async function accessibleBranches(req: Request) {
  if (!req.user) throw new HttpError(401, 'Authentication required');
  if (req.user.role === 'ADMIN') return undefined;
  return (await prisma.userBranch.findMany({ where: { userId: req.user.id }, select: { branchId: true } })).map((row) => row.branchId);
}

export const personController = {
  async list(req: Request, res: Response) { res.json({ data: await personService.list({ ...personQuerySchema.parse(req.query), branchIds: await accessibleBranches(req) }) }); },
  async get(req: Request, res: Response) { res.json({ data: await personService.get(req.params.id, await accessibleBranches(req)) }); },
  async duplicates(req: Request, res: Response) { res.json({ data: await personService.findDuplicates({ ...duplicatePersonQuerySchema.parse(req.query), branchIds: await accessibleBranches(req) }) }); },
  async create(req: Request, res: Response) {
    if (!req.user) throw new HttpError(401, 'Authentication required');
    const input = personFieldsSchema.parse(req.body);
    await accessService.assertBranchAccess(req.user.id, req.user.role, input.preferredBranchId);
    const data = await personService.create(input, auditContext(req));
    res.status(201).json({ data });
  },
  async merge(req: Request, res: Response) {
    const input = mergePersonSchema.parse(req.body);
    res.json({ data: await personService.merge(req.params.id, input.duplicatePersonId, auditContext(req)) });
  },
};

