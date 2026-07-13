import { Router } from 'express';
import { billingController } from '../controllers/billing.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const billingRoutes = Router();

billingRoutes.use(requireAuth);

billingRoutes.get('/invoices', (req, res, next) => {
  billingController.listInvoices(req, res).catch(next);
});

billingRoutes.post('/invoices', (req, res, next) => {
  billingController.createInvoice(req, res).catch(next);
});

billingRoutes.post('/invoices/:id/payments', (req, res, next) => {
  billingController.addPayment(req, res).catch(next);
});

billingRoutes.get('/invoices/:id/pdf', (req, res, next) => {
  billingController.pdf(req, res).catch(next);
});
