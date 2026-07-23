-- CreateEnum
CREATE TYPE "EstimateStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BillingItemType" AS ENUM ('SERVICE', 'PACKAGE', 'PRODUCT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'REVERSED', 'FAILED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PROCESSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CreditNoteStatus" AS ENUM ('DRAFT', 'ISSUED', 'APPLIED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DiscountApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DiscountApprovalLevel" AS ENUM ('MANAGER', 'OWNER');

-- CreateEnum
CREATE TYPE "PatientPackageStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAUSED', 'COMPLETED', 'EXPIRED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PackageLedgerAction" AS ENUM ('PURCHASE', 'RESERVATION', 'SESSION_CONSUMPTION', 'SESSION_REVERSAL', 'TRANSFER', 'PAUSE', 'EXTENSION', 'REFUND', 'EXPIRY_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "CashClosingStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- DropIndex
DROP INDEX "TreatmentPackage_patientId_idx";

-- DropIndex
DROP INDEX "TreatmentPackage_branchId_idx";

-- DropIndex
DROP INDEX "Invoice_branchId_idx";

-- DropIndex
DROP INDEX "Invoice_status_idx";

-- DropIndex
DROP INDEX "Payment_patientId_idx";

-- DropIndex
DROP INDEX "Payment_paidAt_idx";

-- AlterTable
ALTER TABLE "TreatmentPackage" ADD COLUMN     "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "expiryDate" TIMESTAMP(3),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "outstandingAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "packageMasterId" TEXT,
ADD COLUMN     "purchaseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "reservedSessions" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "status" "PatientPackageStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "collectionNotes" TEXT,
ADD COLUMN     "collectionOwnerId" TEXT,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "discountReason" TEXT,
ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "estimateId" TEXT,
ADD COLUMN     "issuedAt" TIMESTAMP(3),
ADD COLUMN     "lastReminderAt" TIMESTAMP(3),
ADD COLUMN     "nextFollowUpAt" TIMESTAMP(3),
ADD COLUMN     "outstandingAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "paymentPromiseDate" TIMESTAMP(3),
ADD COLUMN     "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "terms" TEXT,
ALTER COLUMN "serviceName" SET DEFAULT 'Itemized services';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "allocatedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "branchId" TEXT,
ADD COLUMN     "collectedById" TEXT,
ADD COLUMN     "gatewayEventId" TEXT,
ADD COLUMN     "gatewayVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paymentNo" TEXT,
ADD COLUMN     "reversalReason" TEXT,
ADD COLUMN     "reversedAt" TIMESTAMP(3),
ADD COLUMN     "reversedById" TEXT,
ADD COLUMN     "status" "PaymentStatus" NOT NULL DEFAULT 'COMPLETED',
ADD COLUMN     "updatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PackageMaster" (
    "id" TEXT NOT NULL,
    "branchId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "includedServices" JSONB NOT NULL,
    "totalSessions" INTEGER NOT NULL,
    "validityDays" INTEGER NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "taxPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "branchRestrictions" JSONB,
    "practitionerRestrictions" JSONB,
    "transferRules" TEXT,
    "pauseRules" TEXT,
    "extensionRules" TEXT,
    "cancellationRules" TEXT,
    "refundRules" TEXT,
    "maximumDiscountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackageMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageSessionLedger" (
    "id" TEXT NOT NULL,
    "patientPackageId" TEXT NOT NULL,
    "action" "PackageLedgerAction" NOT NULL,
    "sessionDelta" INTEGER NOT NULL DEFAULT 0,
    "reservedDelta" INTEGER NOT NULL DEFAULT 0,
    "consumedDelta" INTEGER NOT NULL DEFAULT 0,
    "balanceRemaining" INTEGER NOT NULL,
    "procedureSessionId" TEXT,
    "referencePackageId" TEXT,
    "amount" DECIMAL(12,2),
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "metadata" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackageSessionLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Estimate" (
    "id" TEXT NOT NULL,
    "estimateNo" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "estimateDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "status" "EstimateStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "terms" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Estimate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstimateItem" (
    "id" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "type" "BillingItemType" NOT NULL,
    "description" TEXT NOT NULL,
    "serviceId" TEXT,
    "packageMasterId" TEXT,
    "productName" TEXT,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EstimateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "type" "BillingItemType" NOT NULL,
    "description" TEXT NOT NULL,
    "serviceId" TEXT,
    "packageMasterId" TEXT,
    "patientPackageId" TEXT,
    "productName" TEXT,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "refundNo" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "approvalNotes" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "refundMethod" "PaymentMode",
    "transactionReference" TEXT,
    "notes" TEXT,
    "requestedById" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditNote" (
    "id" TEXT NOT NULL,
    "creditNoteNo" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "CreditNoteStatus" NOT NULL DEFAULT 'DRAFT',
    "issuedById" TEXT,
    "issuedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "transactionReference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscountApproval" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "discountAmount" DECIMAL(12,2) NOT NULL,
    "discountPercent" DECIMAL(5,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "requiredLevel" "DiscountApprovalLevel" NOT NULL,
    "status" "DiscountApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "decisionNotes" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscountApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyCashClosing" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "closingDate" DATE NOT NULL,
    "openingCash" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cashCollected" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cardCollected" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "upiCollected" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "bankTransferCollected" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "otherCollected" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "refunds" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "expenses" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "expectedClosingCash" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "actualClosingCash" DECIMAL(12,2),
    "difference" DECIMAL(12,2),
    "closingNotes" TEXT,
    "status" "CashClosingStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyCashClosing_pkey" PRIMARY KEY ("id")
);

-- Preserve and enrich legacy billing and package rows before new constraints are installed.
UPDATE "Invoice"
SET "subtotal" = GREATEST("totalAmount" + "discount" - "gstAmount", 0),
    "taxAmount" = "gstAmount",
    "outstandingAmount" = GREATEST("totalAmount" - "paidAmount", 0),
    "dueDate" = COALESCE("dueDate", "invoiceDate"),
    "issuedAt" = COALESCE("issuedAt", "invoiceDate"),
    "status" = CASE WHEN "status" = 'DRAFT' AND "paidAmount" = 0 THEN 'ISSUED'::"InvoiceStatus" ELSE "status" END;

INSERT INTO "InvoiceItem" ("id", "invoiceId", "type", "description", "quantity", "unitPrice", "discount", "taxPercent", "taxAmount", "totalAmount", "sortOrder")
SELECT 'legacy_item_' || "id", "id", 'CUSTOM'::"BillingItemType", "serviceName", 1,
       GREATEST("consultationFee" + "packageFee", 0), "discount", 0, "gstAmount", "totalAmount", 10
FROM "Invoice";

UPDATE "Payment" p
SET "paymentNo" = 'PAY-LEGACY-' || p."id",
    "branchId" = COALESCE((SELECT i."branchId" FROM "Invoice" i WHERE i."id" = p."invoiceId"), pt."branchId"),
    "allocatedAmount" = CASE WHEN p."invoiceId" IS NULL THEN 0 ELSE p."amount" END,
    "updatedAt" = p."createdAt"
FROM "Patient" pt
WHERE pt."id" = p."patientId";

ALTER TABLE "Payment" ALTER COLUMN "paymentNo" SET NOT NULL;
ALTER TABLE "Payment" ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "Payment" ALTER COLUMN "updatedAt" SET NOT NULL;

INSERT INTO "PaymentAllocation" ("id", "paymentId", "invoiceId", "amount", "createdAt")
SELECT 'legacy_allocation_' || "id", "id", "invoiceId", "amount", "createdAt"
FROM "Payment"
WHERE "invoiceId" IS NOT NULL;

INSERT INTO "PackageMaster" ("id", "branchId", "name", "description", "includedServices", "totalSessions", "validityDays", "price", "active", "createdAt", "updatedAt")
SELECT 'legacy_pm_' || md5("branchId" || ':' || "name"), "branchId", "name", 'Migrated from legacy patient packages',
       jsonb_build_array("name"), MAX("totalSessions"), 365, MAX("amount"), true, MIN("createdAt"), MAX("updatedAt")
FROM "TreatmentPackage"
GROUP BY "branchId", "name";

UPDATE "TreatmentPackage" tp
SET "packageMasterId" = pm."id",
    "purchaseDate" = tp."createdAt",
    "startDate" = tp."createdAt",
    "expiryDate" = tp."createdAt" + INTERVAL '365 days',
    "outstandingAmount" = GREATEST(tp."amount" - tp."paidAmount", 0),
    "status" = CASE
      WHEN tp."completedSessions" >= tp."totalSessions" THEN 'COMPLETED'::"PatientPackageStatus"
      WHEN tp."paidAmount" > 0 THEN 'ACTIVE'::"PatientPackageStatus"
      ELSE 'PENDING'::"PatientPackageStatus"
    END
FROM "PackageMaster" pm
WHERE pm."branchId" = tp."branchId" AND pm."name" = tp."name";

INSERT INTO "PackageSessionLedger" ("id", "patientPackageId", "action", "sessionDelta", "balanceRemaining", "amount", "effectiveAt", "notes", "createdAt")
SELECT 'legacy_purchase_' || "id", "id", 'PURCHASE'::"PackageLedgerAction", "totalSessions", "totalSessions", "amount", "createdAt", 'Legacy package purchase backfill', "createdAt"
FROM "TreatmentPackage";

INSERT INTO "PackageSessionLedger" ("id", "patientPackageId", "action", "sessionDelta", "consumedDelta", "balanceRemaining", "effectiveAt", "notes", "createdAt")
SELECT 'legacy_consumption_' || "id", "id", 'SESSION_CONSUMPTION'::"PackageLedgerAction", -"completedSessions", "completedSessions", GREATEST("totalSessions" - "completedSessions", 0), "updatedAt", 'Legacy consumption aggregate backfill', "updatedAt"
FROM "TreatmentPackage"
WHERE "completedSessions" > 0;

-- CreateIndex
CREATE INDEX "PackageMaster_active_idx" ON "PackageMaster"("active");

-- CreateIndex
CREATE UNIQUE INDEX "PackageMaster_branchId_name_key" ON "PackageMaster"("branchId", "name");

-- CreateIndex
CREATE INDEX "PackageSessionLedger_patientPackageId_effectiveAt_idx" ON "PackageSessionLedger"("patientPackageId", "effectiveAt");

-- CreateIndex
CREATE INDEX "PackageSessionLedger_procedureSessionId_idx" ON "PackageSessionLedger"("procedureSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Estimate_estimateNo_key" ON "Estimate"("estimateNo");

-- CreateIndex
CREATE INDEX "Estimate_patientId_estimateDate_idx" ON "Estimate"("patientId", "estimateDate");

-- CreateIndex
CREATE INDEX "Estimate_branchId_status_idx" ON "Estimate"("branchId", "status");

-- CreateIndex
CREATE INDEX "EstimateItem_estimateId_sortOrder_idx" ON "EstimateItem"("estimateId", "sortOrder");

-- CreateIndex
CREATE INDEX "InvoiceItem_invoiceId_sortOrder_idx" ON "InvoiceItem"("invoiceId", "sortOrder");

-- CreateIndex
CREATE INDEX "PaymentAllocation_invoiceId_idx" ON "PaymentAllocation"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAllocation_paymentId_invoiceId_key" ON "PaymentAllocation"("paymentId", "invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_refundNo_key" ON "Refund"("refundNo");

-- CreateIndex
CREATE INDEX "Refund_branchId_status_idx" ON "Refund"("branchId", "status");

-- CreateIndex
CREATE INDEX "Refund_invoiceId_idx" ON "Refund"("invoiceId");

-- CreateIndex
CREATE INDEX "Refund_paymentId_idx" ON "Refund"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditNote_creditNoteNo_key" ON "CreditNote"("creditNoteNo");

-- CreateIndex
CREATE INDEX "CreditNote_branchId_status_idx" ON "CreditNote"("branchId", "status");

-- CreateIndex
CREATE INDEX "CreditNote_invoiceId_idx" ON "CreditNote"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscountApproval_invoiceId_key" ON "DiscountApproval"("invoiceId");

-- CreateIndex
CREATE INDEX "DiscountApproval_status_requiredLevel_idx" ON "DiscountApproval"("status", "requiredLevel");

-- CreateIndex
CREATE INDEX "DailyCashClosing_status_closingDate_idx" ON "DailyCashClosing"("status", "closingDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailyCashClosing_branchId_closingDate_key" ON "DailyCashClosing"("branchId", "closingDate");

-- CreateIndex
CREATE INDEX "TreatmentPackage_patientId_status_idx" ON "TreatmentPackage"("patientId", "status");

-- CreateIndex
CREATE INDEX "TreatmentPackage_branchId_status_idx" ON "TreatmentPackage"("branchId", "status");

-- CreateIndex
CREATE INDEX "TreatmentPackage_packageMasterId_idx" ON "TreatmentPackage"("packageMasterId");

-- CreateIndex
CREATE INDEX "TreatmentPackage_expiryDate_status_idx" ON "TreatmentPackage"("expiryDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_estimateId_key" ON "Invoice"("estimateId");

-- CreateIndex
CREATE INDEX "Invoice_branchId_status_idx" ON "Invoice"("branchId", "status");

-- CreateIndex
CREATE INDEX "Invoice_dueDate_status_idx" ON "Invoice"("dueDate", "status");

-- CreateIndex
CREATE INDEX "Invoice_collectionOwnerId_nextFollowUpAt_idx" ON "Invoice"("collectionOwnerId", "nextFollowUpAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_paymentNo_key" ON "Payment"("paymentNo");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_gatewayEventId_key" ON "Payment"("gatewayEventId");

-- CreateIndex
CREATE INDEX "Payment_patientId_paidAt_idx" ON "Payment"("patientId", "paidAt");

-- CreateIndex
CREATE INDEX "Payment_branchId_paidAt_idx" ON "Payment"("branchId", "paidAt");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- AddForeignKey
ALTER TABLE "PackageMaster" ADD CONSTRAINT "PackageMaster_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentPackage" ADD CONSTRAINT "TreatmentPackage_packageMasterId_fkey" FOREIGN KEY ("packageMasterId") REFERENCES "PackageMaster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageSessionLedger" ADD CONSTRAINT "PackageSessionLedger_patientPackageId_fkey" FOREIGN KEY ("patientPackageId") REFERENCES "TreatmentPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageSessionLedger" ADD CONSTRAINT "PackageSessionLedger_procedureSessionId_fkey" FOREIGN KEY ("procedureSessionId") REFERENCES "ProcedureSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageSessionLedger" ADD CONSTRAINT "PackageSessionLedger_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateItem" ADD CONSTRAINT "EstimateItem_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateItem" ADD CONSTRAINT "EstimateItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ClinicService"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateItem" ADD CONSTRAINT "EstimateItem_packageMasterId_fkey" FOREIGN KEY ("packageMasterId") REFERENCES "PackageMaster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_collectionOwnerId_fkey" FOREIGN KEY ("collectionOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ClinicService"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_packageMasterId_fkey" FOREIGN KEY ("packageMasterId") REFERENCES "PackageMaster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_patientPackageId_fkey" FOREIGN KEY ("patientPackageId") REFERENCES "TreatmentPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_collectedById_fkey" FOREIGN KEY ("collectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountApproval" ADD CONSTRAINT "DiscountApproval_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountApproval" ADD CONSTRAINT "DiscountApproval_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountApproval" ADD CONSTRAINT "DiscountApproval_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyCashClosing" ADD CONSTRAINT "DailyCashClosing_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyCashClosing" ADD CONSTRAINT "DailyCashClosing_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyCashClosing" ADD CONSTRAINT "DailyCashClosing_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
