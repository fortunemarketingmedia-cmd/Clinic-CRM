import type { Request, Response } from 'express';
import { inventoryService } from '../services/inventory.service.js';
import { HttpError } from '../utils/http-error.js';
import { alertActionSchema, consumableConfigSchema, consumptionConfirmSchema, goodsReceiptSchema, inventoryQuerySchema, movementReverseSchema, productSchema, productUpdateSchema, purchaseOrderActionSchema, purchaseOrderSchema, stockAdjustmentSchema, stockTransferActionSchema, stockTransferSchema, vendorSchema, vendorUpdateSchema } from '../validations/inventory.validation.js';

function actor(req: Request) { if (!req.user) throw new HttpError(401, 'Authentication required'); return { id: req.user.id, role: req.user.role, userId: req.user.id, branchId: typeof req.query.branchId === 'string' ? req.query.branchId : undefined, ipAddress: req.ip, device: req.header('user-agent'), correlationId: req.correlationId }; }
export const inventoryController = {
  async listProducts(req: Request, res: Response) { return res.json({ data: await inventoryService.listProducts(actor(req)) }); },
  async createProduct(req: Request, res: Response) { return res.status(201).json({ data: await inventoryService.createProduct(productSchema.parse(req.body), actor(req)) }); },
  async updateProduct(req: Request, res: Response) { return res.json({ data: await inventoryService.updateProduct(req.params.id, productUpdateSchema.parse(req.body), actor(req)) }); },
  async listVendors(req: Request, res: Response) { return res.json({ data: await inventoryService.listVendors(actor(req)) }); },
  async createVendor(req: Request, res: Response) { return res.status(201).json({ data: await inventoryService.createVendor(vendorSchema.parse(req.body), actor(req)) }); },
  async updateVendor(req: Request, res: Response) { return res.json({ data: await inventoryService.updateVendor(req.params.id, vendorUpdateSchema.parse(req.body), actor(req)) }); },
  async listStock(req: Request, res: Response) { return res.json({ data: await inventoryService.listStock(inventoryQuerySchema.parse(req.query), actor(req)) }); },
  async listBatches(req: Request, res: Response) { return res.json({ data: await inventoryService.listBatches(inventoryQuerySchema.parse(req.query), actor(req)) }); },
  async listMovements(req: Request, res: Response) { return res.json({ data: await inventoryService.listMovements(inventoryQuerySchema.parse(req.query), actor(req)) }); },
  async reverseMovement(req: Request, res: Response) { return res.status(201).json({ data: await inventoryService.reverseMovement(req.params.id, movementReverseSchema.parse(req.body), actor(req)) }); },
  async listConfigs(req: Request, res: Response) { return res.json({ data: await inventoryService.listConsumableConfigs(actor(req)) }); },
  async saveConfig(req: Request, res: Response) { return res.status(201).json({ data: await inventoryService.saveConsumableConfig(consumableConfigSchema.parse(req.body), actor(req)) }); },
  async listPurchaseOrders(req: Request, res: Response) { return res.json({ data: await inventoryService.listPurchaseOrders(inventoryQuerySchema.parse(req.query), actor(req)) }); },
  async createPurchaseOrder(req: Request, res: Response) { return res.status(201).json({ data: await inventoryService.createPurchaseOrder(purchaseOrderSchema.parse(req.body), actor(req)) }); },
  async purchaseOrderAction(req: Request, res: Response) { return res.json({ data: await inventoryService.purchaseOrderAction(req.params.id, purchaseOrderActionSchema.parse(req.body), actor(req)) }); },
  async listGoodsReceipts(req: Request, res: Response) { return res.json({ data: await inventoryService.listGoodsReceipts(inventoryQuerySchema.parse(req.query), actor(req)) }); },
  async createGoodsReceipt(req: Request, res: Response) { return res.status(201).json({ data: await inventoryService.createGoodsReceipt(goodsReceiptSchema.parse(req.body), actor(req)) }); },
  async listTransfers(req: Request, res: Response) { return res.json({ data: await inventoryService.listTransfers(inventoryQuerySchema.parse(req.query), actor(req)) }); },
  async createTransfer(req: Request, res: Response) { return res.status(201).json({ data: await inventoryService.createTransfer(stockTransferSchema.parse(req.body), actor(req)) }); },
  async transferAction(req: Request, res: Response) { return res.json({ data: await inventoryService.transferAction(req.params.id, stockTransferActionSchema.parse(req.body), actor(req)) }); },
  async createAdjustment(req: Request, res: Response) { return res.status(201).json({ data: await inventoryService.createAdjustment(stockAdjustmentSchema.parse(req.body), actor(req)) }); },
  async listConsumptions(req: Request, res: Response) { return res.json({ data: await inventoryService.listConsumptions(inventoryQuerySchema.parse(req.query), actor(req)) }); },
  async stageConsumption(req: Request, res: Response) { return res.status(201).json({ data: await inventoryService.stageProcedureConsumption(req.params.procedureSessionId, actor(req)) }); },
  async confirmConsumption(req: Request, res: Response) { return res.json({ data: await inventoryService.confirmConsumption(req.params.id, consumptionConfirmSchema.parse(req.body), actor(req)) }); },
  async listAlerts(req: Request, res: Response) { return res.json({ data: await inventoryService.listAlerts(inventoryQuerySchema.parse(req.query), actor(req)) }); },
  async updateAlert(req: Request, res: Response) { return res.json({ data: await inventoryService.updateAlert(req.params.id, alertActionSchema.parse(req.body), actor(req)) }); },
};
