import { Role } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { deletableRecords, recordDeletionService } from '../services/record-deletion.service.js';

// DELETE /api/records/:kind/:id — admin-only soft delete for patients, leads, follow-ups, tasks, waitlist entries,
// appointments, treatment records, consultation notes, sittings, files, invoices and packages.
const params = z.object({ kind: z.enum(deletableRecords), id: z.string().min(1) });

export const recordRoutes = Router();
recordRoutes.use(requireAuth);
recordRoutes.delete('/:kind/:id', requireRole(Role.ADMIN), (req, res, next) => {
  const { kind, id } = params.parse(req.params);
  recordDeletionService
    .softDelete(kind, id, req.user!.id, { userId: req.user!.id, ipAddress: req.ip, device: req.header('user-agent'), correlationId: req.correlationId })
    .then((data) => res.json({ data }))
    .catch(next);
});
