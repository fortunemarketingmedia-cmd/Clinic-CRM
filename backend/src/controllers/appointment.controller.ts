import type { Request, Response } from 'express';
import { AppointmentResource, AppointmentStatus, Role } from '@prisma/client';
import { appointmentService } from '../services/appointment.service.js';
import { HttpError } from '../utils/http-error.js';
import {
  appointmentQuerySchema,
  createAppointmentSchema,
  updateAppointmentSchema,
} from '../validations/appointment.validation.js';

function assertStatusPermission(role: Role, status?: AppointmentStatus, resourceType?: AppointmentResource) {
  if (!status) return;
  const receptionStatuses: AppointmentStatus[] = [AppointmentStatus.CHECKED_IN, AppointmentStatus.WAITING];
  const doctorStatuses: AppointmentStatus[] = [AppointmentStatus.IN_CONSULTATION, AppointmentStatus.TREATMENT_IN_PROGRESS, AppointmentStatus.BILLING_PENDING, AppointmentStatus.COMPLETED];
  const doctorRoles: Role[] = [Role.ADMIN];
  if (receptionStatuses.includes(status) && role !== Role.RECEPTIONIST) {
    throw new HttpError(403, 'Only reception can mark arrival and check in a client');
  }
  const receptionistRoomCheckout = role === Role.RECEPTIONIST && resourceType === AppointmentResource.TREATMENT_ROOM && status === AppointmentStatus.COMPLETED;
  if (doctorStatuses.includes(status) && !doctorRoles.includes(role) && !receptionistRoomCheckout) {
    throw new HttpError(403, 'Only a doctor can start the clinical workflow or check out a client');
  }
}

export const appointmentController = {
  async list(req: Request, res: Response) {
    if (!req.user) {
      throw new HttpError(401, 'Authentication required');
    }

    const query = appointmentQuerySchema.parse(req.query);
    const appointments = await appointmentService.listAppointments({ ...query, role: req.user.role, userId: req.user.id });
    return res.json({ data: appointments.items, meta: { total: appointments.total, page: appointments.page, pageSize: appointments.pageSize, totalPages: Math.ceil(appointments.total / appointments.pageSize) } });
  },

  async get(req: Request, res: Response) {
    if (!req.user) throw new HttpError(401, 'Authentication required');
    const appointment = await appointmentService.getAppointment(req.params.id, req.user);
    return res.json({ data: appointment });
  },

  async create(req: Request, res: Response) {
    if (!req.user) {
      throw new HttpError(401, 'Authentication required');
    }

    const input = createAppointmentSchema.parse(req.body);
    const appointment = await appointmentService.createAppointment({ ...input, createdById: req.user.id }, { userId: req.user.id, ipAddress: req.ip, device: req.header('user-agent'), correlationId: req.correlationId });
    return res.status(201).json({ data: appointment });
  },

  async update(req: Request, res: Response) {
    if (!req.user) throw new HttpError(401, 'Authentication required');
    const existingAppointment = await appointmentService.getAppointment(req.params.id, req.user);
    const input = updateAppointmentSchema.parse(req.body);
    assertStatusPermission(req.user.role, input.status, existingAppointment.resourceType);
    const appointment = await appointmentService.updateAppointment(req.params.id, input, { userId: req.user.id, ipAddress: req.ip, device: req.header('user-agent'), correlationId: req.correlationId });
    return res.json({ data: appointment });
  },

  async cancel(req: Request, res: Response) {
    if (!req.user) throw new HttpError(401, 'Authentication required');
    await appointmentService.getAppointment(req.params.id, req.user);
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : 'Cancelled by clinic';
    const appointment = await appointmentService.cancelAppointment(req.params.id, reason, { userId: req.user.id, ipAddress: req.ip, device: req.header('user-agent'), correlationId: req.correlationId });
    return res.json({ data: appointment });
  },

  async delete(req: Request, res: Response) {
    if (!req.user) throw new HttpError(401, 'Authentication required');
    await appointmentService.getAppointment(req.params.id, req.user);
    await appointmentService.deleteAppointment(req.params.id);
    return res.status(204).send();
  },
};
