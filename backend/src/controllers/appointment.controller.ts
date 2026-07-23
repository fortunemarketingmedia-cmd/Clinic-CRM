import type { Request, Response } from 'express';
import { appointmentService } from '../services/appointment.service.js';
import { HttpError } from '../utils/http-error.js';
import {
  appointmentQuerySchema,
  createAppointmentSchema,
  updateAppointmentSchema,
} from '../validations/appointment.validation.js';

export const appointmentController = {
  async list(req: Request, res: Response) {
    if (!req.user) {
      throw new HttpError(401, 'Authentication required');
    }

    const query = appointmentQuerySchema.parse(req.query);
    const appointments = await appointmentService.listAppointments({ ...query, role: req.user.role, userId: req.user.id });
    return res.json({ data: appointments });
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
    await appointmentService.getAppointment(req.params.id, req.user);
    const input = updateAppointmentSchema.parse(req.body);
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
