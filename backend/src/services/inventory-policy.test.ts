import assert from 'node:assert/strict';
import test from 'node:test';
import { alertFlags, assertPurchaseOrderTransition, assertStockAvailable, assertTransferTransition, purchaseOrderTotals } from './inventory-policy.js';

test('purchase order totals calculate tax per line', () => {
  assert.deepEqual(purchaseOrderTotals([{ quantity: 10, rate: 25, taxPercent: 18 }, { quantity: 2, rate: 100, taxPercent: 5 }]), { subtotal: 450, taxAmount: 55, totalAmount: 505 });
});

test('stock guards prevent zero, negative, and over-consumption', () => {
  assert.throws(() => assertStockAvailable(2, 3), /Insufficient stock/);
  assert.throws(() => assertStockAvailable(2, 0), /greater than zero/);
  assert.doesNotThrow(() => assertStockAvailable(3, 3));
});

test('procurement and transfer lifecycles reject skipped custody states', () => {
  assert.doesNotThrow(() => assertPurchaseOrderTransition('DRAFT', 'APPROVAL_PENDING'));
  assert.throws(() => assertPurchaseOrderTransition('DRAFT', 'RECEIVED'), /cannot move/);
  assert.doesNotThrow(() => assertTransferTransition('APPROVED', 'IN_TRANSIT'));
  assert.throws(() => assertTransferTransition('APPROVED', 'RECEIVED'), /cannot move/);
});

test('inventory alerts identify low, negative, near-expiry, and expired stock', () => {
  const now = new Date('2026-07-21T00:00:00Z');
  assert.deepEqual(alertFlags({ availableQuantity: -1, reorderLevel: 5 }, [{ availableQuantity: 2, expiryDate: new Date('2026-07-20') }, { availableQuantity: 1, expiryDate: new Date('2026-08-01') }], now), { lowStock: true, negativeStock: true, nearExpiry: true, expired: true });
});
