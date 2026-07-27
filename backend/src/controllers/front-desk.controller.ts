import type { Request, Response } from 'express';
import { frontDeskService } from '../services/front-desk.service.js';
import { HttpError } from '../utils/http-error.js';
import { availabilityQuerySchema, branchQuerySchema, catalogQuerySchema, exceptionSchema, resourceSchema, scheduleAppointmentsQuerySchema, scheduleQuerySchema, scheduleSchema, serviceSchema } from '../validations/front-desk.validation.js';
import { accessService } from '../services/access.service.js';
import { auditService } from '../services/audit.service.js';

const audit = (req: Request, branchId?: string) => ({ userId: req.user?.id, branchId, ipAddress: req.ip, device: req.header('user-agent'), correlationId: req.correlationId });

async function guard(req: Request, branchId?: string) {
  if (!req.user) throw new HttpError(401, 'Authentication required');
  const global = ['ADMIN', 'ORGANISATION_OWNER', 'CLINIC_ADMIN', 'AUDITOR'].includes(req.user.role);
  if (!branchId && !global) throw new HttpError(400, 'Branch is required');
  await accessService.assertBranchAccess(req.user.id, req.user.role, branchId);
}

export const frontDeskController = {
  async services(req: Request, res: Response) { const query = catalogQuerySchema.parse(req.query); await guard(req, query.branchId); res.json({ data: await frontDeskService.listServices(query.branchId) }); },
  async createService(req: Request, res: Response) { const input = serviceSchema.parse(req.body); await guard(req, input.branchId); const data = await frontDeskService.createService(input); await auditService.record(audit(req, input.branchId), { action: 'CLINIC_SERVICE_CREATED', entity: 'ClinicService', entityId: data.id }); res.status(201).json({ data }); },
  async resources(req: Request, res: Response) { const query = catalogQuerySchema.parse(req.query); await guard(req, query.branchId); res.json({ data: await frontDeskService.listResources(query.branchId, query.type) }); },
  async createResource(req: Request, res: Response) { const input = resourceSchema.parse(req.body); await guard(req, input.branchId); const data = await frontDeskService.createResource(input); await auditService.record(audit(req, input.branchId), { action: 'CLINIC_RESOURCE_CREATED', entity: 'ClinicResource', entityId: data.id }); res.status(201).json({ data }); },
  async staff(req: Request, res: Response) { const query = catalogQuerySchema.parse(req.query); await guard(req, query.branchId); res.json({ data: await frontDeskService.listStaff(query.branchId) }); },
  async schedules(req: Request, res: Response) { const query = scheduleQuerySchema.parse(req.query); await guard(req, query.branchId); res.json({ data: await frontDeskService.listSchedules(query.branchId, query.userId) }); },
  async createSchedule(req: Request, res: Response) { const input = scheduleSchema.parse(req.body); await guard(req, input.branchId); const data = await frontDeskService.createSchedule(input); await auditService.record(audit(req, input.branchId), { action: 'STAFF_SCHEDULE_CREATED', entity: 'StaffSchedule', entityId: data.id }); res.status(201).json({ data }); },
  async createException(req: Request, res: Response) { const input = exceptionSchema.parse(req.body); await guard(req, input.branchId); const data = await frontDeskService.createException(input); await auditService.record(audit(req, input.branchId), { action: 'SCHEDULE_EXCEPTION_CREATED', entity: 'ScheduleException', entityId: data.id }); res.status(201).json({ data }); },
  async availability(req: Request, res: Response) { const query = availabilityQuerySchema.parse(req.query); await guard(req, query.branchId); res.json({ data: await frontDeskService.availability(query) }); },
  async queue(req: Request, res: Response) { if (!req.user) throw new HttpError(401, 'Authentication required'); const { branchId } = branchQuerySchema.parse(req.query); res.json({ data: await frontDeskService.todayQueue(branchId, req.user.id, req.user.role) }); },
  async scheduleAppointments(req: Request, res: Response) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    const query = scheduleAppointmentsQuerySchema.parse({
      dateFrom: today.toISOString(),
      dateTo: nextWeek.toISOString(),
      ...req.query,
    });
    await guard(req, query.branchId);
    res.json({ data: await frontDeskService.scheduleAppointments(query) });
  },
};
