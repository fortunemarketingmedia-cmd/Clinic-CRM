import assert from 'node:assert/strict';
import test from 'node:test';
import { agingBucket, assertPackageAction, calculateDocument, discountLimit, resolvedInvoiceStatus } from './billing-policy.js';

test('itemized billing totals discounts and tax deterministically', () => {
  const result = calculateDocument([{ quantity: 2, unitPrice: 100, discount: 20, taxPercent: 18 }, { quantity: 1, unitPrice: 50 }]);
  assert.deepEqual({ subtotal: result.subtotal, discount: result.discount, tax: result.taxAmount, total: result.totalAmount }, { subtotal: 250, discount: 20, tax: 32.4, total: 262.4 });
});

test('invoice status reflects allocations and overdue dates', () => {
  assert.equal(resolvedInvoiceStatus('ISSUED', 100, 20), 'PARTIAL');
  assert.equal(resolvedInvoiceStatus('ISSUED', 100, 100), 'PAID');
  assert.equal(resolvedInvoiceStatus('ISSUED', 100, 0, new Date('2020-01-01'), new Date('2020-01-02')), 'OVERDUE');
  assert.equal(resolvedInvoiceStatus('DRAFT', 100, 100), 'DRAFT');
});

test('collections aging uses required buckets', () => {
  assert.equal(agingBucket(new Date('2026-01-01'), new Date('2026-01-06')), '1_7_DAYS');
  assert.equal(agingBucket(new Date('2026-01-01'), new Date('2026-04-15')), 'OVER_90_DAYS');
});

test('discount and package policies enforce authority and balances', () => {
  assert.equal(discountLimit('RECEPTIONIST'), 5); assert.equal(discountLimit('BRANCH_MANAGER'), 5);
  assert.throws(() => assertPackageAction('ACTIVE', 'SESSION_CONSUMPTION', 0), /enough remaining/);
  assert.throws(() => assertPackageAction('PAUSED', 'SESSION_CONSUMPTION', 5), /active packages/);
  assert.throws(() => assertPackageAction('ACTIVE', 'RESERVATION', 0), /enough remaining/);
});
