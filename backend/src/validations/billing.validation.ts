import { BillingItemType, CashClosingStatus, CreditNoteStatus, EstimateStatus, InvoiceStatus, PackageLedgerAction, PatientPackageStatus, PaymentMode, RefundStatus } from '@prisma/client';
import { z } from 'zod';

export const billingItemSchema = z.object({
  type: z.nativeEnum(BillingItemType).default('CUSTOM'), description: z.string().trim().min(2), serviceId: z.string().optional(), packageMasterId: z.string().optional(), patientPackageId: z.string().optional(), productName: z.string().optional(), quantity: z.coerce.number().positive().default(1), unitPrice: z.coerce.number().min(0), discount: z.coerce.number().min(0).default(0), taxPercent: z.coerce.number().min(0).max(100).default(0), sortOrder: z.coerce.number().int().min(0).default(0),
});

export const estimateSchema = z.object({ patientId: z.string().min(1), branchId: z.string().min(1), validUntil: z.coerce.date().optional(), notes: z.string().optional(), terms: z.string().optional(), status: z.nativeEnum(EstimateStatus).default('DRAFT'), items: z.array(billingItemSchema).min(1) });
export const estimateQuerySchema = z.object({ branchId: z.string().optional(), patientId: z.string().optional(), status: z.nativeEnum(EstimateStatus).optional() });
export const estimateStatusSchema = z.object({ status: z.nativeEnum(EstimateStatus) });

export const invoiceSchema = z.object({
  patientId: z.string().min(1), branchId: z.string().min(1), dueDate: z.coerce.date().optional(), notes: z.string().optional(), terms: z.string().optional(), discountReason: z.string().optional(),
  items: z.array(billingItemSchema).min(1).optional(), serviceName: z.string().min(2).optional(), consultationFee: z.coerce.number().min(0).default(0), packageFee: z.coerce.number().min(0).default(0), discount: z.coerce.number().min(0).default(0), gstAmount: z.coerce.number().min(0).default(0),
}).refine((value) => value.items?.length || value.serviceName, { message: 'Invoice items are required', path: ['items'] });
export const invoiceQuerySchema = z.object({ branchId: z.string().optional(), patientId: z.string().optional(), status: z.nativeEnum(InvoiceStatus).optional() });
export const invoiceIssueSchema = z.object({ dueDate: z.coerce.date().optional(), terms: z.string().optional() });
export const invoiceCancelSchema = z.object({ reason: z.string().trim().min(3) });

export const paymentSchema = z.object({ patientId: z.string().min(1), branchId: z.string().optional(), amount: z.coerce.number().positive(), mode: z.nativeEnum(PaymentMode), paidAt: z.coerce.date().optional(), reference: z.string().optional(), notes: z.string().optional(), allocations: z.array(z.object({ invoiceId: z.string().min(1), amount: z.coerce.number().positive() })).optional() });
export const paymentQuerySchema = z.object({ branchId: z.string().optional(), patientId: z.string().optional(), invoiceId: z.string().optional() });
export const paymentReverseSchema = z.object({ reason: z.string().trim().min(3) });
export const paymentAllocationSchema = z.object({ invoiceId: z.string().min(1), amount: z.coerce.number().positive() });
export const gatewayCallbackSchema = z.object({ eventId: z.string().min(3), paymentNo: z.string().min(3), status: z.enum(['COMPLETED', 'FAILED']), transactionReference: z.string().optional(), signature: z.string().min(16) });

export const refundSchema = z.object({ invoiceId: z.string().min(1), paymentId: z.string().min(1), reason: z.string().trim().min(3), amount: z.coerce.number().positive(), refundMethod: z.nativeEnum(PaymentMode).optional(), notes: z.string().optional() });
export const refundQuerySchema = z.object({ branchId: z.string().optional(), status: z.nativeEnum(RefundStatus).optional() });
export const refundDecisionSchema = z.object({ approved: z.boolean(), notes: z.string().optional() });
export const refundProcessSchema = z.object({ transactionReference: z.string().trim().min(2), refundMethod: z.nativeEnum(PaymentMode) });

export const creditNoteSchema = z.object({ invoiceId: z.string().min(1), reason: z.string().trim().min(3), amount: z.coerce.number().positive(), notes: z.string().optional() });
export const creditNoteQuerySchema = z.object({ branchId: z.string().optional(), status: z.nativeEnum(CreditNoteStatus).optional() });

export const collectionQuerySchema = z.object({ branchId: z.string().optional(), aging: z.string().optional() });
export const collectionUpdateSchema = z.object({ lastReminderAt: z.coerce.date().optional(), nextFollowUpAt: z.coerce.date().optional(), collectionOwnerId: z.string().optional(), paymentPromiseDate: z.coerce.date().optional(), collectionNotes: z.string().optional() });

export const packageMasterSchema = z.object({ branchId: z.string().optional(), name: z.string().trim().min(3), description: z.string().optional(), includedServices: z.array(z.string()).min(1), totalSessions: z.coerce.number().int().positive(), validityDays: z.coerce.number().int().positive(), price: z.coerce.number().min(0), taxPercent: z.coerce.number().min(0).max(100).default(0), branchRestrictions: z.array(z.string()).optional(), practitionerRestrictions: z.array(z.string()).optional(), transferRules: z.string().optional(), pauseRules: z.string().optional(), extensionRules: z.string().optional(), cancellationRules: z.string().optional(), refundRules: z.string().optional(), maximumDiscountPercent: z.coerce.number().min(0).max(100).default(0), active: z.boolean().default(true) });
export const packageMasterUpdateSchema = packageMasterSchema.partial();
export const patientPackageSchema = z.object({ patientId: z.string().min(1), packageMasterId: z.string().min(1), branchId: z.string().min(1), startDate: z.coerce.date().optional(), discount: z.coerce.number().min(0).default(0), taxPercent: z.coerce.number().min(0).max(100).optional(), paidAmount: z.coerce.number().min(0).default(0), notes: z.string().optional() });
export const patientPackageQuerySchema = z.object({ patientId: z.string().optional(), branchId: z.string().optional(), status: z.nativeEnum(PatientPackageStatus).optional() });
export const packageActionSchema = z.object({ action: z.nativeEnum(PackageLedgerAction), sessions: z.coerce.number().int().positive().default(1), procedureSessionId: z.string().optional(), referencePackageId: z.string().optional(), targetPatientId: z.string().optional(), targetBranchId: z.string().optional(), amount: z.coerce.number().min(0).optional(), effectiveAt: z.coerce.date().optional(), extensionDays: z.coerce.number().int().positive().optional(), notes: z.string().trim().min(2), metadata: z.record(z.string(), z.unknown()).optional() });

export const discountDecisionSchema = z.object({ approved: z.boolean(), notes: z.string().optional() });
export const cashClosingSchema = z.object({ branchId: z.string().min(1), closingDate: z.coerce.date(), openingCash: z.coerce.number().min(0).default(0), expenses: z.coerce.number().min(0).default(0), actualClosingCash: z.coerce.number().min(0).optional(), closingNotes: z.string().optional() });
export const cashClosingQuerySchema = z.object({ branchId: z.string().optional(), status: z.nativeEnum(CashClosingStatus).optional() });
export const cashClosingSubmitSchema = z.object({ actualClosingCash: z.coerce.number().min(0), closingNotes: z.string().optional() });
export const cashClosingDecisionSchema = z.object({ approved: z.boolean(), notes: z.string().optional() });
