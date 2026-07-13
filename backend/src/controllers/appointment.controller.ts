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
    const appointments = await appointmentService.listAppointments({ ...query, role: req.user.role });
    return res.json({ data: appointments });
  },

  async get(req: Request, res: Response) {
    const appointment = await appointmentService.getAppointment(req.params.id);
    return res.json({ data: appointment });
  },

  async create(req: Request, res: Response) {
    if (!req.user) {
      throw new HttpError(401, 'Authentication required');
    }

    const input = createAppointmentSchema.parse(req.body);
    const appointment = await appointmentService.createAppointment({ ...input, createdById: req.user.id });
    return res.status(201).json({ data: appointment });
  },

  async update(req: Request, res: Response) {
    const input = updateAppointmentSchema.parse(req.body);
    const appointment = await appointmentService.updateAppointment(req.params.id, input);
    return res.json({ data: appointment });
  },

  async cancel(req: Request, res: Response) {
    const appointment = await appointmentService.cancelAppointment(req.params.id);
    return res.json({ data: appointment });
  },

  async delete(req: Request, res: Response) {
    await appointmentService.deleteAppointment(req.params.id);
    return res.status(204).send();
  },
};
