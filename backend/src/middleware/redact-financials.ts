import type { NextFunction, Request, Response } from 'express';

/**
 * Money-related fields that only administrators may receive. Receptionists keep every operational field
 * (sessions, appointments, consents) but never see invoices, payments, balances or package prices.
 */
const financialKeys = new Set([
  'invoices', 'payments', 'paymentAllocations', 'refunds', 'creditNotes', 'estimates',
  'outstandingAmount', 'paidAmount', 'totalAmount', 'taxAmount', 'gstAmount', 'amount', 'discount',
  'advancePaymentStatus', 'collectionStatus', 'collectionNotes',
  'basePrice', 'price', 'subtotal', 'consultationFee', 'packageFee', 'unitPrice',
  'billed', 'collected', 'revenue', 'todayRevenue', 'monthlyRevenue', 'financial',
]);

export function redactFinancials<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => redactFinancials(item)) as T;
  if (value && typeof value === 'object' && !(value instanceof Date) && typeof (value as { toJSON?: unknown }).toJSON !== 'function') {
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (financialKeys.has(key)) continue;
      output[key] = redactFinancials(child);
    }
    return output as T;
  }
  return value;
}

/** Router-level guard: every JSON response for a non-administrator is stripped of financial fields. */
export function redactFinancialsForNonAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role === 'ADMIN') return next();
  const json = res.json.bind(res);
  res.json = (body: unknown) => json(redactFinancials(body));
  return next();
}
