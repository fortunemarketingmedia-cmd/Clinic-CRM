import type { PurchaseOrderStatus, StockTransferStatus } from '@prisma/client';
import { HttpError } from '../utils/http-error.js';

export type QuantityLike = number | string | { toString(): string };

export function quantity(value: QuantityLike) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new HttpError(400, 'Stock quantity must be numeric');
  return Math.round(parsed * 1_000) / 1_000;
}

export function assertStockAvailable(available: QuantityLike, requested: QuantityLike) {
  const onHand = quantity(available);
  const needed = quantity(requested);
  if (needed <= 0) throw new HttpError(400, 'Stock quantity must be greater than zero');
  if (onHand < needed) throw new HttpError(409, `Insufficient stock: ${onHand} available, ${needed} required`);
}

export function purchaseOrderTotals(items: Array<{ quantity: QuantityLike; rate: QuantityLike; taxPercent: QuantityLike }>) {
  const subtotal = items.reduce((sum, item) => sum + quantity(item.quantity) * Number(item.rate), 0);
  const taxAmount = items.reduce((sum, item) => sum + quantity(item.quantity) * Number(item.rate) * Number(item.taxPercent) / 100, 0);
  return { subtotal: Math.round(subtotal * 100) / 100, taxAmount: Math.round(taxAmount * 100) / 100, totalAmount: Math.round((subtotal + taxAmount) * 100) / 100 };
}

const poTransitions: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  DRAFT: ['APPROVAL_PENDING', 'CANCELLED'],
  APPROVAL_PENDING: ['APPROVED', 'DRAFT', 'CANCELLED'],
  APPROVED: ['ORDERED', 'CANCELLED'],
  ORDERED: ['PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'],
  PARTIALLY_RECEIVED: ['RECEIVED', 'CANCELLED'],
  RECEIVED: [],
  CANCELLED: [],
};

export function assertPurchaseOrderTransition(current: PurchaseOrderStatus, next: PurchaseOrderStatus) {
  if (!poTransitions[current].includes(next)) throw new HttpError(409, `Purchase order cannot move from ${current} to ${next}`);
}

const transferTransitions: Record<StockTransferStatus, StockTransferStatus[]> = {
  DRAFT: ['APPROVAL_PENDING', 'CANCELLED'],
  APPROVAL_PENDING: ['APPROVED', 'DRAFT', 'CANCELLED'],
  APPROVED: ['IN_TRANSIT', 'CANCELLED'],
  IN_TRANSIT: ['RECEIVED'],
  RECEIVED: [],
  CANCELLED: [],
};

export function assertTransferTransition(current: StockTransferStatus, next: StockTransferStatus) {
  if (!transferTransitions[current].includes(next)) throw new HttpError(409, `Stock transfer cannot move from ${current} to ${next}`);
}

export function alertFlags(stock: { availableQuantity: QuantityLike; reorderLevel: QuantityLike }, batches: Array<{ availableQuantity: QuantityLike; expiryDate?: Date | null }>, now = new Date()) {
  const nearExpiry = new Date(now.getTime() + 60 * 86_400_000);
  return {
    lowStock: quantity(stock.availableQuantity) <= quantity(stock.reorderLevel),
    negativeStock: quantity(stock.availableQuantity) < 0,
    nearExpiry: batches.some((batch) => quantity(batch.availableQuantity) > 0 && Boolean(batch.expiryDate && batch.expiryDate > now && batch.expiryDate <= nearExpiry)),
    expired: batches.some((batch) => quantity(batch.availableQuantity) > 0 && Boolean(batch.expiryDate && batch.expiryDate <= now)),
  };
}

