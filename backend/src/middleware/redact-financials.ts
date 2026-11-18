/**
 * Money-related fields that only administrators may receive. Receptionists keep every operational field
 * (sessions, appointments, consents) but never see invoices, payments, balances or package prices.
 */
const financialKeys = new Set([
  'estimatedAmount', 'taxPercent', 'discountPercent', 'maximumDiscountPercent', 'advancePaymentRequired',
  'invoices', 'payments', 'paymentAllocations', 'refunds', 'creditNotes', 'estimates',
  'outstandingAmount', 'paidAmount', 'totalAmount', 'taxAmount', 'gstAmount', 'amount', 'discount',
  'advancePaymentStatus', 'collectionStatus', 'collectionNotes',
  'basePrice', 'price', 'subtotal', 'consultationFee', 'packageFee', 'unitPrice',
  'billed', 'collected', 'revenue', 'todayRevenue', 'monthlyRevenue', 'financial',
]);

const financialEvents = new Set(['ESTIMATE_CREATED', 'INVOICE_GENERATED', 'PAYMENT_COLLECTED', 'PACKAGE_PURCHASED']);

export function redactFinancials<T>(value: T): T {
  if (Array.isArray(value)) return value.filter((item) => !item || typeof item !== 'object' || !financialEvents.has(String((item as { type?: unknown }).type))).map((item) => redactFinancials(item)) as T;
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
