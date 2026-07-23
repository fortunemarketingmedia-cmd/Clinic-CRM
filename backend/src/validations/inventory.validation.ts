import { GoodsReceiptStatus, InventoryAlertStatus, ProductType, PurchaseOrderStatus, StockState, StockTransferStatus } from '@prisma/client';
import { z } from 'zod';

const positiveQuantity = z.coerce.number().positive().multipleOf(0.001);
const money = z.coerce.number().min(0).multipleOf(0.01);
export const inventoryQuerySchema = z.object({ branchId: z.string().optional(), status: z.string().optional(), productId: z.string().optional(), take: z.coerce.number().int().min(1).max(500).default(100) });

export const productSchema = z.object({ sku: z.string().trim().min(2).max(64), name: z.string().trim().min(2), category: z.string().trim().min(2), brand: z.string().trim().optional(), unit: z.string().trim().min(1), type: z.nativeEnum(ProductType), taxPercent: z.coerce.number().min(0).max(100).default(0), purchasePrice: money.default(0), sellingPrice: money.default(0), reorderLevel: z.coerce.number().min(0).multipleOf(0.001).default(0), prescriptionOnly: z.boolean().default(false), active: z.boolean().default(true) });
export const productUpdateSchema = productSchema.partial();
export const vendorSchema = z.object({ name: z.string().trim().min(2), contactPerson: z.string().trim().optional(), mobile: z.string().trim().optional(), email: z.string().email().optional(), address: z.string().trim().optional(), gstNumber: z.string().trim().optional(), paymentTerms: z.string().trim().optional(), productCategories: z.array(z.string()).default([]), active: z.boolean().default(true) });
export const vendorUpdateSchema = vendorSchema.partial();
export const consumableConfigSchema = z.object({ serviceId: z.string(), productId: z.string(), quantity: positiveQuantity, requiresConfirmation: z.boolean().default(true), active: z.boolean().default(true) });

const poItemSchema = z.object({ productId: z.string(), quantity: positiveQuantity, rate: money, taxPercent: z.coerce.number().min(0).max(100).default(0) });
export const purchaseOrderSchema = z.object({ vendorId: z.string(), branchId: z.string(), expectedDelivery: z.coerce.date().optional(), notes: z.string().optional(), items: z.array(poItemSchema).min(1) });
export const purchaseOrderActionSchema = z.object({ status: z.nativeEnum(PurchaseOrderStatus), notes: z.string().trim().optional() });

const goodsReceiptItemSchema = z.object({ purchaseOrderItemId: z.string(), productId: z.string(), quantity: positiveQuantity, purchaseCost: money, batchNumber: z.string().trim().min(1), manufacturingDate: z.coerce.date().optional(), expiryDate: z.coerce.date().optional(), storageRequirement: z.string().optional() });
export const goodsReceiptSchema = z.object({ purchaseOrderId: z.string(), invoiceNumber: z.string().optional(), invoiceDate: z.coerce.date().optional(), notes: z.string().optional(), status: z.nativeEnum(GoodsReceiptStatus).default('POSTED'), items: z.array(goodsReceiptItemSchema).min(1) });

const transferItemSchema = z.object({ productId: z.string(), batchNumber: z.string().trim().min(1), quantity: positiveQuantity });
export const stockTransferSchema = z.object({ fromBranchId: z.string(), toBranchId: z.string(), expectedAt: z.coerce.date().optional(), notes: z.string().optional(), items: z.array(transferItemSchema).min(1) }).refine((value) => value.fromBranchId !== value.toBranchId, { message: 'Transfer branches must be different' });
export const stockTransferActionSchema = z.object({ status: z.nativeEnum(StockTransferStatus), notes: z.string().optional(), items: z.array(z.object({ itemId: z.string(), receivedQuantity: z.coerce.number().min(0).multipleOf(0.001) })).optional() });

export const stockAdjustmentSchema = z.object({ branchId: z.string(), productId: z.string(), batchId: z.string().optional(), state: z.nativeEnum(StockState).default('AVAILABLE'), quantity: z.coerce.number().refine((value) => value !== 0, 'Adjustment quantity cannot be zero').refine((value) => Number.isInteger(value * 1000), 'Use at most three decimal places'), reason: z.string().trim().min(3), notes: z.string().optional() });
export const consumptionConfirmSchema = z.object({ notes: z.string().optional(), items: z.array(z.object({ itemId: z.string(), actualQuantity: positiveQuantity, batchId: z.string().optional() })).optional() });
export const alertActionSchema = z.object({ status: z.nativeEnum(InventoryAlertStatus) });
export const movementReverseSchema = z.object({ reason: z.string().trim().min(3) });
