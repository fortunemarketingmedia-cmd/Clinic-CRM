# Phase 6 — Inventory and Procurement

Status: implemented and verified through a clean full-chain migration, seed run, policy tests, production builds, and end-to-end API checks against an isolated PostgreSQL database. The migration has not been applied to a production database.

## Delivered

- Product master with SKU, category, brand, unit, type, tax, purchase and selling prices, reorder level, prescription-only flag, and active status.
- Consumable, medicine, retail-product, device-accessory, disposable, and other product types.
- Vendor master with contacts, address, GST number, payment terms, product categories, and active status.
- Branch-level aggregate stock for available, reserved, damaged, expired, and in-transit quantities.
- Batch register with manufacturing and expiry dates, supplier, purchase cost, received and state quantities, branch, and storage requirements.
- Immutable movement ledger for purchase, procedure consumption, retail sale, transfer out/in, adjustment, damage, expiry, return, and reversal types.
- Purchase-order lifecycle: draft, approval pending, approved, ordered, partially received, received, and cancelled.
- Manager-only PO approval and transactionally posted goods receipts.
- Goods receipts update PO received quantities, create or extend inventory batches, update branch stock, and append purchase movements in one serializable transaction.
- Inter-branch transfer lifecycle: draft, approval pending, approved, in transit, received, and cancelled.
- Transfer dispatch moves source stock from available to in transit; receipt removes source transit custody, creates or extends the destination batch, and adds destination available stock.
- Manager-authorized, reason-required stock adjustments and eligible movement reversals.
- Per-service consumable configuration with quantity and review-before-deduction controls.
- Completing a configured procedure automatically stages expected consumables. Review-required configurations remain pending until staff confirm actual consumption; non-review configurations attempt immediate FEFO deduction.
- FEFO consumption across unexpired batches, with hard prevention of ordinary negative stock.
- Low-stock, near-expiry, expired-stock, negative-stock, unusual-consumption, delayed-PO, and pending-transfer alerts with acknowledgement and resolution states.
- Branch isolation, inventory-manager permissions, manager approvals, audit events, and idempotent procedure staging.

## Data integrity rules

- `BranchStock` is the branch aggregate; `InventoryBatch` is the batch-level source of custody and expiry.
- Every posted quantity change writes a `StockMovement` in the same serializable transaction.
- Movement rows are never edited or deleted. Eligible mistakes are corrected with a linked `REVERSAL` movement.
- Goods receipts cannot exceed the open PO quantity.
- Consumption selects the earliest-expiring usable stock first and never consumes an expired batch.
- Transfer dispatch and receipt are separate custody events. A transfer cannot skip approval or in-transit status.
- Purchase and transfer movements must be reversed through their source workflow; direct ledger reversal is restricted to movements that can be safely inverted without breaking procurement custody.
- Legacy free-text `ProcedureSession.consumables` and `batchNumbers` are retained for historical clinical records. They are not silently converted into stock because they lack reliable product, quantity, branch-custody, and source-batch references.

## Main database additions

- `Product`, `Vendor`, `BranchStock`, and `InventoryBatch`
- `StockMovement` and `StockAdjustment`
- `ProcedureConsumableConfig`, `ProcedureConsumption`, and `ProcedureConsumptionItem`
- `PurchaseOrder`, `PurchaseOrderItem`, `GoodsReceipt`, and `GoodsReceiptItem`
- `StockTransfer` and `StockTransferItem`
- `InventoryAlert`

Migration: `20260722030000_phase_6_inventory_procurement`.

## APIs

- `GET/POST/PATCH /api/inventory/products`
- `GET/POST/PATCH /api/inventory/vendors`
- `GET /api/inventory/stock`, `/batches`, and `/movements`
- `POST /api/inventory/movements/:id/reverse`
- `GET/POST /api/inventory/procedure-consumables/config`
- `GET /api/inventory/procedure-consumptions`
- `POST /api/inventory/procedure-consumptions/stage/:procedureSessionId`
- `POST /api/inventory/procedure-consumptions/:id/confirm`
- `GET/POST /api/inventory/purchase-orders`
- `POST /api/inventory/purchase-orders/:id/actions`
- `GET/POST /api/inventory/goods-receipts`
- `GET/POST /api/inventory/transfers`
- `POST /api/inventory/transfers/:id/actions`
- `POST /api/inventory/adjustments`
- `GET/PATCH /api/inventory/alerts`

## Frontend

- `/products` — product master.
- `/branch-stock` — branch totals and stock-state balances.
- `/inventory-batches` — batches, storage, expiry, and adjustments.
- `/purchases` — purchase orders, approvals, goods receipts, and transfers.
- `/vendors` — vendor master.
- `/stock-movements` — procedure configuration and review plus the immutable ledger and reversal action.

All pages are available to inventory managers and management roles. Approval and adjustment operations remain restricted to management roles.

## Seed data

- Inventory manager: `inventory@reviveclinic.local` with the shared local seed password.
- Four representative product-master records covering consumables, disposables, and retail stock.
- One clearly labelled demonstration vendor.
- Review-required glove and gauze configurations for the seeded treatment-session service.

The seed does not create opening stock. Initial stock must enter through a posted goods receipt or a documented opening-balance adjustment so its origin remains auditable.

## Verification performed

- Replayed all 18 migrations from an empty database and ran the complete seed.
- Verified inventory-manager access and manager-only purchase approval.
- Created and approved a taxed multi-line PO, marked it ordered, and posted a multi-batch goods receipt.
- Verified PO totals, batch metadata, branch totals, and purchase ledger entries.
- Completed the full transfer custody lifecycle and reconciled source and destination branch balances.
- Staged and confirmed configured procedure consumption and verified FEFO deductions.
- Completed a clinical procedure through the clinical API and verified automatic consumption staging.
- Generated low-stock and near-expiry alerts.
- Verified a manager-authorized movement reversal creates a linked `REVERSAL` entry.
- Passed Prisma validation, backend policy tests, backend build/lint, frontend typecheck/lint, and the production frontend build.

## Deployment checklist

1. Restore a recent production backup into an isolated environment.
2. Apply `20260722030000_phase_6_inventory_procurement` after both Phase 5 migrations.
3. Review units of measure, tax rates, reorder levels, expiry windows, and approval ownership with clinic operations.
4. Create product and vendor masters before importing opening balances.
5. Import each opening batch with its branch, quantity, cost, expiry, and documented source; create matching opening adjustment movements.
6. Reconcile aggregate branch stock to batch-state totals before go-live.
7. Configure per-service consumables and keep review enabled until operations validates expected quantities.
8. Test one PO, receipt, procedure deduction, adjustment, and branch transfer in every active branch.

## Phase boundary

Phase 7 should implement the official WhatsApp communication centre: provider setup, verified webhooks, shared inbox, templates, appointment reminders, lead sequences, delivery statuses, opt-outs, and consent-aware automation.
