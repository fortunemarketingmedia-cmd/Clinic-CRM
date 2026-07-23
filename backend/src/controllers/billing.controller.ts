import type { Request, Response } from 'express';
import { z } from 'zod';
import { billingService } from '../services/billing.service.js';
import { HttpError } from '../utils/http-error.js';
import { cashClosingDecisionSchema, cashClosingQuerySchema, cashClosingSchema, cashClosingSubmitSchema, collectionQuerySchema, collectionUpdateSchema, creditNoteQuerySchema, creditNoteSchema, discountDecisionSchema, estimateQuerySchema, estimateSchema, estimateStatusSchema, gatewayCallbackSchema, invoiceCancelSchema, invoiceIssueSchema, invoiceQuerySchema, invoiceSchema, packageActionSchema, packageMasterSchema, packageMasterUpdateSchema, patientPackageQuerySchema, patientPackageSchema, paymentAllocationSchema, paymentQuerySchema, paymentReverseSchema, paymentSchema, refundDecisionSchema, refundProcessSchema, refundQuerySchema, refundSchema } from '../validations/billing.validation.js';

function actor(req: Request) { if (!req.user) throw new HttpError(401, 'Authentication required'); return { id: req.user.id, role: req.user.role, userId: req.user.id, branchId: typeof req.query.branchId === 'string' ? req.query.branchId : undefined, ipAddress: req.ip, device: req.header('user-agent'), correlationId: req.correlationId }; }
const branchQuery = z.object({ branchId: z.string().optional() });

export const billingController = {
  async listEstimates(req: Request, res: Response) { return res.json({ data: await billingService.listEstimates(estimateQuerySchema.parse(req.query), actor(req)) }); },
  async createEstimate(req: Request, res: Response) { return res.status(201).json({ data: await billingService.createEstimate(estimateSchema.parse(req.body), actor(req)) }); },
  async updateEstimateStatus(req: Request, res: Response) { return res.json({ data: await billingService.updateEstimateStatus(req.params.id, estimateStatusSchema.parse(req.body), actor(req)) }); },
  async convertEstimate(req: Request, res: Response) { return res.status(201).json({ data: await billingService.convertEstimate(req.params.id, invoiceIssueSchema.parse(req.body), actor(req)) }); },
  async listInvoices(req: Request, res: Response) { return res.json({ data: await billingService.listInvoices(invoiceQuerySchema.parse(req.query), actor(req)) }); },
  async createInvoice(req: Request, res: Response) { return res.status(201).json({ data: await billingService.createInvoice(invoiceSchema.parse(req.body), actor(req)) }); },
  async issueInvoice(req: Request, res: Response) { return res.json({ data: await billingService.issueInvoice(req.params.id, invoiceIssueSchema.parse(req.body), actor(req)) }); },
  async cancelInvoice(req: Request, res: Response) { return res.json({ data: await billingService.cancelInvoice(req.params.id, invoiceCancelSchema.parse(req.body), actor(req)) }); },
  async invoicePdf(req: Request, res: Response) { const buffer = await billingService.getInvoicePdf(req.params.id, actor(req)); res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `inline; filename="invoice-${req.params.id}.pdf"`); return res.send(buffer); },
  async listPayments(req: Request, res: Response) { return res.json({ data: await billingService.listPayments(paymentQuerySchema.parse(req.query), actor(req)) }); },
  async addPayment(req: Request, res: Response) { return res.status(201).json({ data: await billingService.addPayment(paymentSchema.parse(req.body), actor(req), req.params.id) }); },
  async allocatePayment(req: Request, res: Response) { return res.status(201).json({ data: await billingService.allocatePayment(req.params.id, paymentAllocationSchema.parse(req.body), actor(req)) }); },
  async reversePayment(req: Request, res: Response) { return res.json({ data: await billingService.reversePayment(req.params.id, paymentReverseSchema.parse(req.body), actor(req)) }); },
  async receiptPdf(req: Request, res: Response) { const buffer = await billingService.getPaymentReceiptPdf(req.params.id, actor(req)); res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `inline; filename="receipt-${req.params.id}.pdf"`); return res.send(buffer); },
  async gatewayCallback(req: Request, res: Response) { return res.json({ data: await billingService.gatewayCallback(gatewayCallbackSchema.parse(req.body)) }); },
  async listRefunds(req: Request, res: Response) { return res.json({ data: await billingService.listRefunds(refundQuerySchema.parse(req.query), actor(req)) }); },
  async requestRefund(req: Request, res: Response) { return res.status(201).json({ data: await billingService.requestRefund(refundSchema.parse(req.body), actor(req)) }); },
  async decideRefund(req: Request, res: Response) { return res.json({ data: await billingService.decideRefund(req.params.id, refundDecisionSchema.parse(req.body), actor(req)) }); },
  async processRefund(req: Request, res: Response) { return res.json({ data: await billingService.processRefund(req.params.id, refundProcessSchema.parse(req.body), actor(req)) }); },
  async listCreditNotes(req: Request, res: Response) { return res.json({ data: await billingService.listCreditNotes(creditNoteQuerySchema.parse(req.query), actor(req)) }); },
  async createCreditNote(req: Request, res: Response) { return res.status(201).json({ data: await billingService.createCreditNote(creditNoteSchema.parse(req.body), actor(req)) }); },
  async applyCreditNote(req: Request, res: Response) { return res.json({ data: await billingService.applyCreditNote(req.params.id, actor(req)) }); },
  async listApprovals(req: Request, res: Response) { const query = branchQuery.parse(req.query); return res.json({ data: await billingService.listDiscountApprovals(query.branchId, actor(req)) }); },
  async decideDiscount(req: Request, res: Response) { return res.json({ data: await billingService.decideDiscount(req.params.id, discountDecisionSchema.parse(req.body), actor(req)) }); },
  async outstanding(req: Request, res: Response) { return res.json({ data: await billingService.listOutstanding(collectionQuerySchema.parse(req.query), actor(req)) }); },
  async updateCollection(req: Request, res: Response) { return res.json({ data: await billingService.updateCollection(req.params.id, collectionUpdateSchema.parse(req.body), actor(req)) }); },
  async listPackageMasters(req: Request, res: Response) { const query = branchQuery.parse(req.query); return res.json({ data: await billingService.listPackageMasters(query.branchId, actor(req)) }); },
  async createPackageMaster(req: Request, res: Response) { return res.status(201).json({ data: await billingService.createPackageMaster(packageMasterSchema.parse(req.body), actor(req)) }); },
  async updatePackageMaster(req: Request, res: Response) { return res.json({ data: await billingService.updatePackageMaster(req.params.id, packageMasterUpdateSchema.parse(req.body), actor(req)) }); },
  async listPatientPackages(req: Request, res: Response) { return res.json({ data: await billingService.listPatientPackages(patientPackageQuerySchema.parse(req.query), actor(req)) }); },
  async purchasePackage(req: Request, res: Response) { return res.status(201).json({ data: await billingService.purchasePackage(patientPackageSchema.parse(req.body), actor(req)) }); },
  async packageAction(req: Request, res: Response) { return res.status(201).json({ data: await billingService.packageAction(req.params.id, packageActionSchema.parse(req.body), actor(req)) }); },
  async listCashClosings(req: Request, res: Response) { return res.json({ data: await billingService.listCashClosings(cashClosingQuerySchema.parse(req.query), actor(req)) }); },
  async createCashClosing(req: Request, res: Response) { return res.status(201).json({ data: await billingService.createCashClosing(cashClosingSchema.parse(req.body), actor(req)) }); },
  async submitCashClosing(req: Request, res: Response) { return res.json({ data: await billingService.submitCashClosing(req.params.id, cashClosingSubmitSchema.parse(req.body), actor(req)) }); },
  async decideCashClosing(req: Request, res: Response) { return res.json({ data: await billingService.decideCashClosing(req.params.id, cashClosingDecisionSchema.parse(req.body), actor(req)) }); },
};
