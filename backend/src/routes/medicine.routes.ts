import { Router } from 'express';
import { medicineController } from '../controllers/medicine.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { medicineImportUpload } from '../middleware/file-upload.js';

export const medicineRoutes = Router();
medicineRoutes.use(requireAuth);
medicineRoutes.get('/', (req, res, next) => { medicineController.list(req, res).catch(next); });
medicineRoutes.get('/forms', (req, res, next) => { medicineController.forms(req, res).catch(next); });
medicineRoutes.post('/import', medicineImportUpload.single('file'), (req, res, next) => { medicineController.import(req, res).catch(next); });
medicineRoutes.post('/', (req, res, next) => { medicineController.create(req, res).catch(next); });
medicineRoutes.patch('/:id', (req, res, next) => { medicineController.update(req, res).catch(next); });
medicineRoutes.delete('/:id', (req, res, next) => { medicineController.remove(req, res).catch(next); });
