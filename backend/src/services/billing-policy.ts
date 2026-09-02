import type { InvoiceStatus, PackageLedgerAction, PatientPackageStatus, Role } from '@prisma/client';
import { HttpError } from '../utils/http-error.js';

export type BillingItemInput = { quantity: number; unitPrice: number; discount?: number; taxPercent?: number };

export function money(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }

export function calculateItem(item: BillingItemInput) {
  const gross = money(item.quantity * item.unitPrice); const discount = money(item.discount ?? 0); const taxable = money(gross - discount);
  if (gross < 0 || discount < 0 || discount > gross || (item.taxPercent ?? 0) < 0) throw new HttpError(400, 'Item amount, discount, or tax is invalid');
  const taxAmount = money(taxable * (item.taxPercent ?? 0) / 100); return { ...item, discount, taxPercent: item.taxPercent ?? 0, taxAmount, totalAmount: money(taxable + taxAmount) };
}

export function calculateDocument(items: BillingItemInput[]) {
  if (!items.length) throw new HttpError(400, 'At least one billing item is required'); const calculated = items.map(calculateItem);
  const subtotal = money(calculated.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)); const discount = money(calculated.reduce((sum, item) => sum + item.discount, 0)); const taxAmount = money(calculated.reduce((sum, item) => sum + item.taxAmount, 0));
  return { items: calculated, subtotal, discount, taxAmount, totalAmount: money(subtotal - discount + taxAmount) };
}

export function resolvedInvoiceStatus(status: InvoiceStatus, total: number, paid: number, dueDate?: Date | null, now = new Date()): InvoiceStatus {
  if (status === 'CANCELLED' || status === 'REFUNDED' || status === 'DRAFT') return status;
  if (paid >= total) return 'PAID'; if (paid > 0) return 'PARTIAL'; if (dueDate && dueDate < now) return 'OVERDUE'; return 'ISSUED';
}

export function agingBucket(dueDate: Date | null, now = new Date()) {
  if (!dueDate) return 'CURRENT'; const days = Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / 86_400_000));
  if (days === 0) return 'CURRENT'; if (days <= 7) return '1_7_DAYS'; if (days <= 30) return '8_30_DAYS'; if (days <= 60) return '31_60_DAYS'; if (days <= 90) return '61_90_DAYS'; return 'OVER_90_DAYS';
}

export function discountLimit(role: Role) {
  if (role === 'ADMIN') return 100;
  return 5;
}

export function requiredApproval(discountPercent: number) { return discountPercent > 20 ? 'OWNER' as const : 'MANAGER' as const; }

export function assertPackageAction(status: PatientPackageStatus, action: PackageLedgerAction, remaining: number, amount = 1) {
  if (['CANCELLED', 'REFUNDED', 'EXPIRED', 'COMPLETED'].includes(status) && action !== 'SESSION_REVERSAL') throw new HttpError(409, `Package action ${action} is not allowed from ${status}`);
  if (action === 'SESSION_CONSUMPTION' && status !== 'ACTIVE') throw new HttpError(409, 'Only active packages can consume sessions');
  if (action === 'SESSION_CONSUMPTION' && amount > remaining) throw new HttpError(409, 'Package does not have enough remaining sessions');
  if (action === 'RESERVATION' && status !== 'ACTIVE') throw new HttpError(409, 'Only active packages can reserve sessions');
  if (action === 'RESERVATION' && amount > remaining) throw new HttpError(409, 'Package does not have enough remaining sessions to reserve');
  if (action === 'PAUSE' && status !== 'ACTIVE') throw new HttpError(409, 'Only active packages can be paused');
}
