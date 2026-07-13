import type { Request, Response } from 'express';
import { billingService } from '../services/billing.service.js';
import { invoiceQuerySchema, invoiceSchema, paymentSchema } from '../validations/billing.validation.js';

export const billingController = {
  async listInvoices(req: Request, res: Response) {
    const query = invoiceQuerySchema.parse(req.query);
    const invoices = await billingService.listInvoices(query);
    return res.json({ data: invoices });
  },

  async createInvoice(req: Request, res: Response) {
    const input = invoiceSchema.parse(req.body);
    const invoice = await billingService.createInvoice(input);
    return res.status(201).json({ data: invoice });
  },

  async addPayment(req: Request, res: Response) {
    const input = paymentSchema.parse(req.body);
    const payment = await billingService.addPayment(req.params.id, input);
    return res.status(201).json({ data: payment });
  },

  async pdf(req: Request, res: Response) {
    const buffer = await billingService.getInvoicePdf(req.params.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="invoice-${req.params.id}.pdf"`);
    return res.send(buffer);
  },
};
