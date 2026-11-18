-- Additive, nullable fields preserve existing invoices and payments unchanged.
ALTER TABLE "Invoice" ADD COLUMN "idempotencyKey" TEXT, ADD COLUMN "idempotencyHash" TEXT;
ALTER TABLE "Payment" ADD COLUMN "idempotencyKey" TEXT, ADD COLUMN "idempotencyHash" TEXT;
CREATE UNIQUE INDEX "Invoice_idempotencyKey_key" ON "Invoice"("idempotencyKey");
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");
