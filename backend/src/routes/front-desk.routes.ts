import { Role } from '@prisma/client';
import { Router } from 'express';
import { frontDeskController } from '../controllers/front-desk.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
export const frontDeskRoutes = Router();
frontDeskRoutes.use(requireAuth);
frontDeskRoutes.get('/services', (req, res, next) => frontDeskController.services(req, res).catch(next));
frontDeskRoutes.get('/resources', (req, res, next) => frontDeskController.resources(req, res).catch(next));
frontDeskRoutes.get('/staff', (req, res, next) => frontDeskController.staff(req, res).catch(next));
frontDeskRoutes.get('/schedules', (req, res, next) => frontDeskController.schedules(req, res).catch(next));
frontDeskRoutes.get('/availability', (req, res, next) => frontDeskController.availability(req, res).catch(next));
frontDeskRoutes.get('/today-queue', (req, res, next) => frontDeskController.queue(req, res).catch(next));
frontDeskRoutes.get('/schedule-appointments', (req, res, next) => frontDeskController.scheduleAppointments(req, res).catch(next));
frontDeskRoutes.post('/services', requireRole(Role.ADMIN, Role.ORGANISATION_OWNER, Role.CLINIC_ADMIN), (req, res, next) => frontDeskController.createService(req, res).catch(next));
frontDeskRoutes.post('/resources', requireRole(Role.ADMIN, Role.ORGANISATION_OWNER, Role.CLINIC_ADMIN), (req, res, next) => frontDeskController.createResource(req, res).catch(next));
frontDeskRoutes.post('/schedules', requireRole(Role.ADMIN, Role.ORGANISATION_OWNER, Role.CLINIC_ADMIN, Role.BRANCH_MANAGER), (req, res, next) => frontDeskController.createSchedule(req, res).catch(next));
frontDeskRoutes.post('/schedule-exceptions', requireRole(Role.ADMIN, Role.ORGANISATION_OWNER, Role.CLINIC_ADMIN, Role.BRANCH_MANAGER), (req, res, next) => frontDeskController.createException(req, res).catch(next));

