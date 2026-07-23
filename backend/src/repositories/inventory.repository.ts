import { randomUUID } from 'node:crypto';
import { Prisma, type InventoryAlertType, type PurchaseOrderStatus, type StockState, type StockTransferStatus } from '@prisma/client';
import { prisma } from '../config/db.js';
import { assertStockAvailable, purchaseOrderTotals, quantity } from '../services/inventory-policy.js';
import { HttpError } from '../utils/http-error.js';

const number = (prefix: string) => `${prefix}-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 8).toUpperCase()}`;
type Tx = Prisma.TransactionClient;
type BalanceColumn = 'availableQuantity' | 'reservedQuantity' | 'damagedQuantity' | 'expiredQuantity' | 'inTransitQuantity';
const columnFor = (state: StockState): BalanceColumn => ({ AVAILABLE: 'availableQuantity', RESERVED: 'reservedQuantity', DAMAGED: 'damagedQuantity', EXPIRED: 'expiredQuantity', IN_TRANSIT: 'inTransitQuantity' })[state] as BalanceColumn;

async function changeBalance(tx: Tx, input: { branchId: string; productId: string; batchId?: string | null; state: StockState; delta: number; allowNegative?: boolean }) {
  const column = columnFor(input.state);
  const stock = await tx.branchStock.upsert({ where: { branchId_productId: { branchId: input.branchId, productId: input.productId } }, create: { branchId: input.branchId, productId: input.productId }, update: {} });
  const after = quantity(stock[column]) + quantity(input.delta);
  if (!input.allowNegative && after < 0) throw new HttpError(409, `Insufficient ${input.state.toLowerCase()} stock`);
  await tx.branchStock.update({ where: { id: stock.id }, data: { [column]: after, lastMovementAt: new Date() } });
  if (input.batchId) {
    const batch = await tx.inventoryBatch.findUniqueOrThrow({ where: { id: input.batchId } });
    if (batch.branchId !== input.branchId || batch.productId !== input.productId) throw new HttpError(409, 'Batch does not belong to this product and branch');
    const batchAfter = quantity(batch[column]) + quantity(input.delta);
    if (!input.allowNegative && batchAfter < 0) throw new HttpError(409, `Insufficient batch ${input.state.toLowerCase()} stock`);
    await tx.inventoryBatch.update({ where: { id: batch.id }, data: { [column]: batchAfter } });
  }
  return after;
}

async function movement(tx: Tx, input: { productId: string; batchId?: string | null; branchId: string; type: Prisma.StockMovementUncheckedCreateInput['type']; state?: StockState; quantity: number; balanceAfter: number; referenceType?: string; referenceId?: string; procedureSessionId?: string; notes?: string; actorId: string; metadata?: Prisma.InputJsonValue }) {
  return tx.stockMovement.create({ data: { movementNo: number('MOV'), state: 'AVAILABLE', ...input } });
}

const productInclude = { branchStocks: { include: { branch: true } }, batches: { include: { branch: true, supplier: true }, orderBy: { expiryDate: 'asc' as const } } };
const poInclude = { vendor: true, branch: true, createdBy: { select: { id: true, name: true } }, approvedBy: { select: { id: true, name: true } }, items: { include: { product: true } }, goodsReceipts: { include: { items: true } } };
const transferInclude = { fromBranch: true, toBranch: true, items: { include: { product: true } }, createdBy: { select: { id: true, name: true } }, approvedBy: { select: { id: true, name: true } }, shippedBy: { select: { id: true, name: true } }, receivedBy: { select: { id: true, name: true } } };

export const inventoryRepository = {
  listProducts() { return prisma.product.findMany({ include: productInclude, orderBy: [{ active: 'desc' }, { name: 'asc' }] }); },
  findProduct(id: string) { return prisma.product.findUnique({ where: { id }, include: productInclude }); },
  createProduct(data: Prisma.ProductCreateInput) { return prisma.product.create({ data, include: productInclude }); },
  updateProduct(id: string, data: Prisma.ProductUpdateInput) { return prisma.product.update({ where: { id }, data, include: productInclude }); },
  listVendors() { return prisma.vendor.findMany({ orderBy: [{ active: 'desc' }, { name: 'asc' }] }); },
  createVendor(data: Prisma.VendorCreateInput) { return prisma.vendor.create({ data }); },
  updateVendor(id: string, data: Prisma.VendorUpdateInput) { return prisma.vendor.update({ where: { id }, data }); },
  listStock(branchId?: string, productId?: string) { return prisma.branchStock.findMany({ where: { branchId, productId }, include: { branch: true, product: true }, orderBy: { product: { name: 'asc' } } }); },
  listBatches(branchId?: string, productId?: string) { return prisma.inventoryBatch.findMany({ where: { branchId, productId }, include: { product: true, branch: true, supplier: true }, orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }] }); },
  listMovements(branchId?: string, productId?: string, take = 100) { return prisma.stockMovement.findMany({ where: { branchId, productId }, include: { product: true, batch: true, branch: true, actor: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' }, take }); },
  findMovement(id: string) { return prisma.stockMovement.findUnique({ where: { id }, include: { reversedBy: true } }); },
  reverseMovement(id: string, reason: string, actorId: string) { return prisma.$transaction(async (tx) => { const original = await tx.stockMovement.findUniqueOrThrow({ where: { id }, include: { reversedBy: true } }); if (original.reversedBy) throw new HttpError(409, 'Stock movement is already reversed'); if (!['ADJUSTMENT', 'PROCEDURE_CONSUMPTION', 'RETAIL_SALE', 'RETURN', 'DAMAGE', 'EXPIRY'].includes(original.type)) throw new HttpError(409, 'This movement must be reversed through its source workflow'); let delta = -quantity(original.quantity); let state = original.state; let balanceAfter: number; if (original.type === 'DAMAGE' || original.type === 'EXPIRY') { await changeBalance(tx, { branchId: original.branchId, productId: original.productId, batchId: original.batchId, state: original.state, delta: -quantity(original.quantity) }); state = 'AVAILABLE'; delta = quantity(original.quantity); balanceAfter = await changeBalance(tx, { branchId: original.branchId, productId: original.productId, batchId: original.batchId, state, delta }); } else balanceAfter = await changeBalance(tx, { branchId: original.branchId, productId: original.productId, batchId: original.batchId, state, delta }); const reversed = await movement(tx, { productId: original.productId, batchId: original.batchId, branchId: original.branchId, type: 'REVERSAL', state, quantity: delta, balanceAfter, referenceType: 'StockMovement', referenceId: original.id, procedureSessionId: original.procedureSessionId ?? undefined, notes: reason, actorId }); await tx.stockMovement.update({ where: { id: reversed.id }, data: { reversalOfId: original.id } }); if (original.referenceType === 'ProcedureConsumption' && original.referenceId) { const remaining = await tx.stockMovement.count({ where: { referenceType: 'ProcedureConsumption', referenceId: original.referenceId, type: 'PROCEDURE_CONSUMPTION', reversedBy: null } }); if (remaining === 0) await tx.procedureConsumption.update({ where: { id: original.referenceId }, data: { status: 'REVERSED' } }); } return tx.stockMovement.findUniqueOrThrow({ where: { id: reversed.id }, include: { product: true, batch: true, branch: true, actor: { select: { id: true, name: true } } } }); }, { isolationLevel: 'Serializable' }); },
  recentConsumptionMovements(branchId?: string) { return prisma.stockMovement.findMany({ where: { branchId, type: 'PROCEDURE_CONSUMPTION', createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } }, include: { product: true }, orderBy: { createdAt: 'desc' } }); },
  listConsumableConfigs() { return prisma.procedureConsumableConfig.findMany({ include: { service: true, product: true }, orderBy: { service: { name: 'asc' } } }); },
  upsertConsumableConfig(data: Prisma.ProcedureConsumableConfigUncheckedCreateInput) { return prisma.procedureConsumableConfig.upsert({ where: { serviceId_productId: { serviceId: data.serviceId, productId: data.productId } }, create: data, update: { quantity: data.quantity, requiresConfirmation: data.requiresConfirmation, active: data.active }, include: { service: true, product: true } }); },
  listPurchaseOrders(branchId?: string, status?: PurchaseOrderStatus) { return prisma.purchaseOrder.findMany({ where: { branchId, status }, include: poInclude, orderBy: { createdAt: 'desc' } }); },
  findPurchaseOrder(id: string) { return prisma.purchaseOrder.findUnique({ where: { id }, include: poInclude }); },
  createPurchaseOrder(input: { vendorId: string; branchId: string; expectedDelivery?: Date; notes?: string; items: Array<{ productId: string; quantity: number; rate: number; taxPercent: number }> }, actorId: string) {
    const totals = purchaseOrderTotals(input.items);
    return prisma.purchaseOrder.create({ data: { poNumber: number('PO'), vendorId: input.vendorId, branchId: input.branchId, expectedDelivery: input.expectedDelivery, notes: input.notes, createdById: actorId, ...totals, items: { create: input.items.map((item) => { const lineSubtotal = item.quantity * item.rate; const taxAmount = Math.round(lineSubtotal * item.taxPercent) / 100; return { ...item, taxAmount, totalAmount: Math.round((lineSubtotal + taxAmount) * 100) / 100 }; }) } }, include: poInclude });
  },
  updatePurchaseOrderStatus(id: string, status: PurchaseOrderStatus, actorId: string, notes?: string) { return prisma.purchaseOrder.update({ where: { id }, data: { status, approvalNotes: notes, ...(status === 'APPROVED' ? { approvedById: actorId, approvedAt: new Date() } : {}) }, include: poInclude }); },
  listGoodsReceipts(branchId?: string) { return prisma.goodsReceipt.findMany({ where: { branchId }, include: { vendor: true, branch: true, purchaseOrder: true, items: { include: { product: true } }, postedBy: { select: { id: true, name: true } } }, orderBy: { receivedAt: 'desc' } }); },
  postGoodsReceipt(input: { purchaseOrderId: string; invoiceNumber?: string; invoiceDate?: Date; notes?: string; items: Array<{ purchaseOrderItemId: string; productId: string; quantity: number; purchaseCost: number; batchNumber: string; manufacturingDate?: Date; expiryDate?: Date; storageRequirement?: string }> }, actorId: string) {
    return prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findUniqueOrThrow({ where: { id: input.purchaseOrderId }, include: { items: true } });
      if (!['ORDERED', 'PARTIALLY_RECEIVED'].includes(po.status)) throw new HttpError(409, 'Goods can only be received for ordered purchase orders');
      for (const item of input.items) {
        const ordered = po.items.find((candidate) => candidate.id === item.purchaseOrderItemId && candidate.productId === item.productId);
        if (!ordered) throw new HttpError(409, 'Receipt item is not part of this purchase order');
        if (quantity(ordered.receivedQuantity) + item.quantity > quantity(ordered.quantity)) throw new HttpError(409, 'Received quantity exceeds the open purchase order quantity');
        if (item.expiryDate && item.manufacturingDate && item.expiryDate <= item.manufacturingDate) throw new HttpError(400, 'Batch expiry must be after manufacturing date');
      }
      const receipt = await tx.goodsReceipt.create({ data: { grnNumber: number('GRN'), purchaseOrderId: po.id, vendorId: po.vendorId, branchId: po.branchId, invoiceNumber: input.invoiceNumber, invoiceDate: input.invoiceDate, notes: input.notes, status: 'POSTED', postedById: actorId, postedAt: new Date(), items: { create: input.items } } });
      for (const item of input.items) {
        const batch = await tx.inventoryBatch.upsert({ where: { productId_branchId_batchNumber: { productId: item.productId, branchId: po.branchId, batchNumber: item.batchNumber } }, create: { productId: item.productId, branchId: po.branchId, supplierId: po.vendorId, batchNumber: item.batchNumber, manufacturingDate: item.manufacturingDate, expiryDate: item.expiryDate, purchaseCost: item.purchaseCost, quantityReceived: item.quantity, availableQuantity: item.quantity, storageRequirement: item.storageRequirement }, update: { quantityReceived: { increment: item.quantity }, availableQuantity: { increment: item.quantity }, purchaseCost: item.purchaseCost, expiryDate: item.expiryDate, manufacturingDate: item.manufacturingDate, storageRequirement: item.storageRequirement } });
        const balanceAfter = await changeBalance(tx, { branchId: po.branchId, productId: item.productId, state: 'AVAILABLE', delta: item.quantity });
        await movement(tx, { productId: item.productId, batchId: batch.id, branchId: po.branchId, type: 'PURCHASE', quantity: item.quantity, balanceAfter, referenceType: 'GoodsReceipt', referenceId: receipt.id, notes: `Received on ${receipt.grnNumber}`, actorId });
        await tx.purchaseOrderItem.update({ where: { id: item.purchaseOrderItemId }, data: { receivedQuantity: { increment: item.quantity } } });
      }
      const openItems = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId: po.id } });
      const complete = openItems.every((item) => quantity(item.receivedQuantity) >= quantity(item.quantity));
      await tx.purchaseOrder.update({ where: { id: po.id }, data: { status: complete ? 'RECEIVED' : 'PARTIALLY_RECEIVED' } });
      return tx.goodsReceipt.findUniqueOrThrow({ where: { id: receipt.id }, include: { vendor: true, branch: true, purchaseOrder: true, items: { include: { product: true } }, postedBy: { select: { id: true, name: true } } } });
    }, { isolationLevel: 'Serializable' });
  },
  listTransfers(branchId?: string, status?: StockTransferStatus) { return prisma.stockTransfer.findMany({ where: { status, OR: branchId ? [{ fromBranchId: branchId }, { toBranchId: branchId }] : undefined }, include: transferInclude, orderBy: { createdAt: 'desc' } }); },
  findTransfer(id: string) { return prisma.stockTransfer.findUnique({ where: { id }, include: transferInclude }); },
  createTransfer(input: { fromBranchId: string; toBranchId: string; expectedAt?: Date; notes?: string; items: Array<{ productId: string; batchNumber: string; quantity: number }> }, actorId: string) { return prisma.stockTransfer.create({ data: { transferNumber: number('TRF'), ...input, createdById: actorId, items: { create: input.items } }, include: transferInclude }); },
  updateTransferStatus(id: string, status: StockTransferStatus, actorId: string, notes?: string) {
    return prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findUniqueOrThrow({ where: { id }, include: { items: true } });
      if (status === 'IN_TRANSIT') {
        for (const item of transfer.items) {
          const batch = await tx.inventoryBatch.findUnique({ where: { productId_branchId_batchNumber: { productId: item.productId, branchId: transfer.fromBranchId, batchNumber: item.batchNumber } } });
          if (!batch) throw new HttpError(409, `Source batch ${item.batchNumber} not found`);
          assertStockAvailable(batch.availableQuantity, item.quantity);
          const availableAfter = await changeBalance(tx, { branchId: transfer.fromBranchId, productId: item.productId, batchId: batch.id, state: 'AVAILABLE', delta: -quantity(item.quantity) });
          await changeBalance(tx, { branchId: transfer.fromBranchId, productId: item.productId, batchId: batch.id, state: 'IN_TRANSIT', delta: quantity(item.quantity) });
          await movement(tx, { productId: item.productId, batchId: batch.id, branchId: transfer.fromBranchId, type: 'TRANSFER_OUT', quantity: -quantity(item.quantity), balanceAfter: availableAfter, referenceType: 'StockTransfer', referenceId: transfer.id, notes: `Transfer to branch ${transfer.toBranchId}`, actorId });
        }
      }
      if (status === 'RECEIVED') {
        for (const item of transfer.items) {
          const source = await tx.inventoryBatch.findUniqueOrThrow({ where: { productId_branchId_batchNumber: { productId: item.productId, branchId: transfer.fromBranchId, batchNumber: item.batchNumber } } });
          assertStockAvailable(source.inTransitQuantity, item.quantity);
          await changeBalance(tx, { branchId: transfer.fromBranchId, productId: item.productId, batchId: source.id, state: 'IN_TRANSIT', delta: -quantity(item.quantity) });
          const destination = await tx.inventoryBatch.upsert({ where: { productId_branchId_batchNumber: { productId: item.productId, branchId: transfer.toBranchId, batchNumber: item.batchNumber } }, create: { productId: item.productId, branchId: transfer.toBranchId, supplierId: source.supplierId, batchNumber: source.batchNumber, manufacturingDate: source.manufacturingDate, expiryDate: source.expiryDate, purchaseCost: source.purchaseCost, quantityReceived: item.quantity, availableQuantity: item.quantity, storageRequirement: source.storageRequirement }, update: { quantityReceived: { increment: item.quantity }, availableQuantity: { increment: item.quantity } } });
          const balanceAfter = await changeBalance(tx, { branchId: transfer.toBranchId, productId: item.productId, state: 'AVAILABLE', delta: quantity(item.quantity) });
          await movement(tx, { productId: item.productId, batchId: destination.id, branchId: transfer.toBranchId, type: 'TRANSFER_IN', quantity: quantity(item.quantity), balanceAfter, referenceType: 'StockTransfer', referenceId: transfer.id, notes: `Transfer from branch ${transfer.fromBranchId}`, actorId });
          await tx.stockTransferItem.update({ where: { id: item.id }, data: { receivedQuantity: item.quantity } });
        }
      }
      return tx.stockTransfer.update({ where: { id }, data: { status, notes: notes ?? transfer.notes, ...(status === 'APPROVED' ? { approvedById: actorId, approvedAt: new Date() } : {}), ...(status === 'IN_TRANSIT' ? { shippedById: actorId, shippedAt: new Date() } : {}), ...(status === 'RECEIVED' ? { receivedById: actorId, receivedAt: new Date() } : {}) }, include: transferInclude });
    }, { isolationLevel: 'Serializable' });
  },
  createAdjustment(input: { branchId: string; productId: string; batchId?: string; state: StockState; quantity: number; reason: string; notes?: string }, actorId: string) {
    return prisma.$transaction(async (tx) => {
      let movementType: Prisma.StockMovementUncheckedCreateInput['type'] = 'ADJUSTMENT';
      let balanceAfter: number;
      if ((input.state === 'DAMAGED' || input.state === 'EXPIRED') && input.quantity > 0) {
        await changeBalance(tx, { branchId: input.branchId, productId: input.productId, batchId: input.batchId, state: 'AVAILABLE', delta: -input.quantity });
        balanceAfter = await changeBalance(tx, { ...input, delta: input.quantity });
        movementType = input.state === 'DAMAGED' ? 'DAMAGE' : 'EXPIRY';
      } else {
        balanceAfter = await changeBalance(tx, { ...input, delta: input.quantity, allowNegative: true });
      }
      const adjustment = await tx.stockAdjustment.create({ data: { adjustmentNo: number('ADJ'), ...input, actorId } });
      await movement(tx, { productId: input.productId, batchId: input.batchId, branchId: input.branchId, type: movementType, state: input.state, quantity: input.quantity, balanceAfter, referenceType: 'StockAdjustment', referenceId: adjustment.id, notes: input.reason, actorId });
      return adjustment;
    }, { isolationLevel: 'Serializable' });
  },
  findProcedureForConsumption(procedureSessionId: string) { return prisma.procedureSession.findUnique({ where: { id: procedureSessionId }, include: { appointment: true, treatmentPlanItem: true, inventoryConsumption: { include: { items: { include: { product: true, batch: true } } } } } }); },
  configsForService(serviceId: string) { return prisma.procedureConsumableConfig.findMany({ where: { serviceId, active: true }, include: { product: true } }); },
  createProcedureConsumption(procedureSessionId: string, branchId: string, configs: Array<{ productId: string; quantity: Prisma.Decimal }>) { return prisma.procedureConsumption.create({ data: { procedureSessionId, branchId, items: { create: configs.map((config) => ({ productId: config.productId, expectedQuantity: config.quantity, actualQuantity: config.quantity })) } }, include: { items: { include: { product: true, batch: true } }, procedureSession: true } }); },
  listConsumptions(branchId?: string, status?: Prisma.EnumProcedureConsumptionStatusFilter) { return prisma.procedureConsumption.findMany({ where: { branchId, status }, include: { procedureSession: { include: { patient: true } }, items: { include: { product: true, batch: true } }, confirmedBy: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } }); },
  confirmConsumption(id: string, overrides: Array<{ itemId: string; actualQuantity: number; batchId?: string }> | undefined, actorId: string, notes?: string) {
    return prisma.$transaction(async (tx) => {
      const consumption = await tx.procedureConsumption.findUniqueOrThrow({ where: { id }, include: { items: true, procedureSession: true } });
      if (consumption.status !== 'PENDING_REVIEW') throw new HttpError(409, 'Only pending consumption can be confirmed');
      if (consumption.procedureSession.status !== 'COMPLETED') throw new HttpError(409, 'Procedure must be completed before stock deduction');
      for (const item of consumption.items) {
        const override = overrides?.find((candidate) => candidate.itemId === item.id);
        let remaining = quantity(override?.actualQuantity ?? item.actualQuantity);
        const batches = override?.batchId ? await tx.inventoryBatch.findMany({ where: { id: override.batchId, branchId: consumption.branchId, productId: item.productId } }) : await tx.inventoryBatch.findMany({ where: { branchId: consumption.branchId, productId: item.productId, availableQuantity: { gt: 0 }, OR: [{ expiryDate: null }, { expiryDate: { gt: new Date() } }] }, orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }] });
        if (!batches.length) throw new HttpError(409, 'No available, unexpired batch found for a consumable');
        let first = true;
        for (const batch of batches) {
          if (remaining <= 0) break;
          const used = Math.min(remaining, quantity(batch.availableQuantity));
          if (used <= 0) continue;
          const balanceAfter = await changeBalance(tx, { branchId: consumption.branchId, productId: item.productId, batchId: batch.id, state: 'AVAILABLE', delta: -used });
          await movement(tx, { productId: item.productId, batchId: batch.id, branchId: consumption.branchId, type: 'PROCEDURE_CONSUMPTION', quantity: -used, balanceAfter, referenceType: 'ProcedureConsumption', referenceId: consumption.id, procedureSessionId: consumption.procedureSessionId, notes: notes ?? 'Procedure consumable confirmed', actorId });
          if (first) await tx.procedureConsumptionItem.update({ where: { id: item.id }, data: { batchId: batch.id, actualQuantity: used } });
          else await tx.procedureConsumptionItem.create({ data: { consumptionId: consumption.id, productId: item.productId, batchId: batch.id, expectedQuantity: 0, actualQuantity: used } });
          first = false;
          remaining = quantity(remaining - used);
        }
        if (remaining > 0) throw new HttpError(409, 'Insufficient unexpired batch stock for procedure consumption');
      }
      return tx.procedureConsumption.update({ where: { id }, data: { status: 'CONFIRMED', confirmedById: actorId, confirmedAt: new Date(), notes }, include: { procedureSession: true, items: { include: { product: true, batch: true } }, confirmedBy: { select: { id: true, name: true } } } });
    }, { isolationLevel: 'Serializable' });
  },
  listAlerts(branchId?: string) { return prisma.inventoryAlert.findMany({ where: { branchId }, include: { branch: true, product: true }, orderBy: { detectedAt: 'desc' } }); },
  createAlert(data: { branchId: string; productId?: string; type: InventoryAlertType; severity?: string; message: string; referenceType?: string; referenceId?: string; metadata?: Prisma.InputJsonValue }) { return prisma.inventoryAlert.create({ data }); },
  findOpenAlert(input: { branchId: string; productId?: string; type: InventoryAlertType; referenceId?: string }) { return prisma.inventoryAlert.findFirst({ where: { ...input, status: { in: ['OPEN', 'ACKNOWLEDGED'] } } }); },
  resolveAlerts(branchId: string, productId: string | undefined, type: InventoryAlertType, referenceId?: string) { return prisma.inventoryAlert.updateMany({ where: { branchId, productId, type, referenceId, status: { not: 'RESOLVED' } }, data: { status: 'RESOLVED', resolvedAt: new Date() } }); },
  updateAlert(id: string, status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED') { return prisma.inventoryAlert.update({ where: { id }, data: { status, acknowledgedAt: status === 'ACKNOWLEDGED' ? new Date() : undefined, resolvedAt: status === 'RESOLVED' ? new Date() : undefined } }); },
};
