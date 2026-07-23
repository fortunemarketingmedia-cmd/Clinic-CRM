-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('META_LEAD_ADS', 'META_ADS_REPORTING', 'META_CONVERSIONS', 'GOOGLE_ADS', 'GOOGLE_LEAD_FORMS', 'GOOGLE_OFFLINE_CONVERSIONS', 'WEBSITE_WEBHOOK');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('DISCONNECTED', 'CONNECTED', 'DEGRADED', 'TOKEN_EXPIRED', 'ERROR');

-- CreateEnum
CREATE TYPE "IntegrationEventStatus" AS ENUM ('RECEIVED', 'QUEUED', 'PROCESSING', 'PROCESSED', 'DUPLICATE', 'FAILED');

-- CreateEnum
CREATE TYPE "IntegrationSyncStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "ConversionPlatform" AS ENUM ('META', 'GOOGLE');

-- CreateEnum
CREATE TYPE "ConversionUploadStatus" AS ENUM ('QUEUED', 'SUBMITTED', 'COMPLETED', 'RETRY', 'FAILED', 'SUPPRESSED');

-- CreateEnum
CREATE TYPE "MarketingCampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AutomationTrigger" AS ENUM ('LEAD_CREATED', 'LEAD_ASSIGNED', 'LEAD_STAGE_CHANGED', 'FOLLOW_UP_OVERDUE', 'APPOINTMENT_BOOKED', 'APPOINTMENT_CONFIRMED', 'APPOINTMENT_MISSED', 'APPOINTMENT_COMPLETED', 'PATIENT_ARRIVED', 'CONSULTATION_COMPLETED', 'TREATMENT_PLAN_CREATED', 'CONSENT_EXPIRED');

-- CreateEnum
CREATE TYPE "AutomationExecutionStatus" AS ENUM ('QUEUED', 'RUNNING', 'WAITING', 'COMPLETED', 'FAILED', 'STOPPED', 'TESTED');

-- CreateEnum
CREATE TYPE "ExportStatus" AS ENUM ('REQUESTED', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "RefreshToken" ADD COLUMN     "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mfaRecoveryCodes" JSONB,
ADD COLUMN     "mfaSecretCiphertext" TEXT,
ADD COLUMN     "mfaVerifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "IntegrationConnection" (
    "id" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "name" TEXT NOT NULL,
    "externalAccountId" TEXT,
    "managerAccountId" TEXT,
    "branchId" TEXT,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "accessTokenCiphertext" TEXT,
    "refreshTokenCiphertext" TEXT,
    "clientSecretCiphertext" TEXT,
    "developerTokenCiphertext" TEXT,
    "appSecretCiphertext" TEXT,
    "verifyTokenCiphertext" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "scopes" JSONB,
    "configuration" JSONB,
    "lastSyncAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "lastFailureReason" TEXT,
    "webhookVerifiedAt" TIMESTAMP(3),
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationFieldMapping" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "externalFormId" TEXT NOT NULL,
    "externalFormName" TEXT,
    "branchId" TEXT,
    "ownerId" TEXT,
    "mapping" JSONB NOT NULL,
    "defaults" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationFieldMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationEvent" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "providerEventId" TEXT,
    "eventHash" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "signature" TEXT,
    "signatureVerified" BOOLEAN NOT NULL DEFAULT false,
    "status" "IntegrationEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "payload" JSONB NOT NULL,
    "processingAttempts" INTEGER NOT NULL DEFAULT 0,
    "leadId" TEXT,
    "failureReason" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationSyncRun" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "IntegrationSyncStatus" NOT NULL DEFAULT 'QUEUED',
    "cursor" TEXT,
    "dateFrom" TIMESTAMP(3),
    "dateTo" TIMESTAMP(3),
    "expectedCount" INTEGER,
    "retrievedCount" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "missingCount" INTEGER NOT NULL DEFAULT 0,
    "details" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingCampaign" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT,
    "externalCampaignId" TEXT,
    "platform" "AdPlatform" NOT NULL,
    "name" TEXT NOT NULL,
    "objective" TEXT,
    "status" "MarketingCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "branchId" TEXT,
    "ownerId" TEXT,
    "budget" DECIMAL(14,2),
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "audience" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdPerformanceDaily" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "branchId" TEXT,
    "date" DATE NOT NULL,
    "externalAdSetId" TEXT,
    "adSetName" TEXT,
    "externalAdId" TEXT,
    "adName" TEXT,
    "device" TEXT,
    "network" TEXT,
    "spend" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "landingPageViews" INTEGER NOT NULL DEFAULT 0,
    "platformConversions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "leads" INTEGER NOT NULL DEFAULT 0,
    "rawMetrics" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdPerformanceDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttributionTouch" (
    "id" TEXT NOT NULL,
    "personId" TEXT,
    "leadId" TEXT,
    "branchId" TEXT,
    "campaignId" TEXT,
    "platform" "AdPlatform",
    "touchType" TEXT NOT NULL,
    "source" TEXT,
    "medium" TEXT,
    "campaignName" TEXT,
    "content" TEXT,
    "term" TEXT,
    "landingPage" TEXT,
    "gclid" TEXT,
    "gbraid" TEXT,
    "wbraid" TEXT,
    "fbclid" TEXT,
    "externalLeadId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttributionTouch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversionEvent" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "platform" "ConversionPlatform" NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "personId" TEXT,
    "leadId" TEXT,
    "campaignId" TEXT,
    "eventTime" TIMESTAMP(3) NOT NULL,
    "conversionAction" TEXT,
    "transactionId" TEXT,
    "value" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "gclid" TEXT,
    "gbraid" TEXT,
    "wbraid" TEXT,
    "consentGranted" BOOLEAN NOT NULL DEFAULT false,
    "status" "ConversionUploadStatus" NOT NULL DEFAULT 'QUEUED',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "providerResponse" JSONB,
    "failureReason" TEXT,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationDefinition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "trigger" "AutomationTrigger" NOT NULL,
    "branchId" TEXT,
    "conditions" JSONB,
    "workflow" JSONB NOT NULL,
    "stopConditions" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "testMode" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationExecution" (
    "id" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "branchId" TEXT,
    "leadId" TEXT,
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "triggerPayload" JSONB,
    "status" "AutomationExecutionStatus" NOT NULL DEFAULT 'QUEUED',
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "executionLog" JSONB,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "errorMessage" TEXT,
    "actorId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "reason" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "branchId" TEXT,
    "resourceType" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "filters" JSONB,
    "rowCount" INTEGER,
    "status" "ExportStatus" NOT NULL DEFAULT 'REQUESTED',
    "purpose" TEXT NOT NULL,
    "ipAddress" TEXT,
    "correlationId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExportLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackupVerification" (
    "id" TEXT NOT NULL,
    "backupReference" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "checksum" TEXT,
    "restoreStartedAt" TIMESTAMP(3),
    "restoreCompletedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "evidence" JSONB,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BackupVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntegrationConnection_provider_status_idx" ON "IntegrationConnection"("provider", "status");

-- CreateIndex
CREATE INDEX "IntegrationConnection_externalAccountId_idx" ON "IntegrationConnection"("externalAccountId");

-- CreateIndex
CREATE INDEX "IntegrationConnection_branchId_provider_idx" ON "IntegrationConnection"("branchId", "provider");

-- CreateIndex
CREATE INDEX "IntegrationFieldMapping_externalFormId_active_idx" ON "IntegrationFieldMapping"("externalFormId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationFieldMapping_connectionId_externalFormId_key" ON "IntegrationFieldMapping"("connectionId", "externalFormId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationEvent_eventHash_key" ON "IntegrationEvent"("eventHash");

-- CreateIndex
CREATE INDEX "IntegrationEvent_connectionId_status_receivedAt_idx" ON "IntegrationEvent"("connectionId", "status", "receivedAt");

-- CreateIndex
CREATE INDEX "IntegrationEvent_providerEventId_idx" ON "IntegrationEvent"("providerEventId");

-- CreateIndex
CREATE INDEX "IntegrationSyncRun_connectionId_status_createdAt_idx" ON "IntegrationSyncRun"("connectionId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "MarketingCampaign_platform_status_startDate_idx" ON "MarketingCampaign"("platform", "status", "startDate");

-- CreateIndex
CREATE INDEX "MarketingCampaign_branchId_status_idx" ON "MarketingCampaign"("branchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingCampaign_connectionId_externalCampaignId_key" ON "MarketingCampaign"("connectionId", "externalCampaignId");

-- CreateIndex
CREATE INDEX "AdPerformanceDaily_branchId_date_idx" ON "AdPerformanceDaily"("branchId", "date");

-- CreateIndex
CREATE INDEX "AdPerformanceDaily_date_idx" ON "AdPerformanceDaily"("date");

-- CreateIndex
CREATE UNIQUE INDEX "AdPerformanceDaily_campaignId_date_externalAdSetId_external_key" ON "AdPerformanceDaily"("campaignId", "date", "externalAdSetId", "externalAdId", "device", "network");

-- CreateIndex
CREATE INDEX "AttributionTouch_leadId_occurredAt_idx" ON "AttributionTouch"("leadId", "occurredAt");

-- CreateIndex
CREATE INDEX "AttributionTouch_personId_occurredAt_idx" ON "AttributionTouch"("personId", "occurredAt");

-- CreateIndex
CREATE INDEX "AttributionTouch_gclid_idx" ON "AttributionTouch"("gclid");

-- CreateIndex
CREATE INDEX "AttributionTouch_externalLeadId_idx" ON "AttributionTouch"("externalLeadId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversionEvent_eventId_key" ON "ConversionEvent"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversionEvent_idempotencyKey_key" ON "ConversionEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ConversionEvent_connectionId_status_nextAttemptAt_idx" ON "ConversionEvent"("connectionId", "status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "ConversionEvent_leadId_eventTime_idx" ON "ConversionEvent"("leadId", "eventTime");

-- CreateIndex
CREATE INDEX "AutomationDefinition_trigger_active_idx" ON "AutomationDefinition"("trigger", "active");

-- CreateIndex
CREATE INDEX "AutomationDefinition_branchId_active_idx" ON "AutomationDefinition"("branchId", "active");

-- CreateIndex
CREATE INDEX "AutomationExecution_status_nextRunAt_idx" ON "AutomationExecution"("status", "nextRunAt");

-- CreateIndex
CREATE INDEX "AutomationExecution_leadId_createdAt_idx" ON "AutomationExecution"("leadId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationExecution_automationId_referenceType_referenceId__key" ON "AutomationExecution"("automationId", "referenceType", "referenceId", "createdAt");

-- CreateIndex
CREATE INDEX "LoginEvent_email_createdAt_idx" ON "LoginEvent"("email", "createdAt");

-- CreateIndex
CREATE INDEX "LoginEvent_userId_createdAt_idx" ON "LoginEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "LoginEvent_success_createdAt_idx" ON "LoginEvent"("success", "createdAt");

-- CreateIndex
CREATE INDEX "ExportLog_userId_createdAt_idx" ON "ExportLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ExportLog_resourceType_createdAt_idx" ON "ExportLog"("resourceType", "createdAt");

-- CreateIndex
CREATE INDEX "BackupVerification_status_createdAt_idx" ON "BackupVerification"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationFieldMapping" ADD CONSTRAINT "IntegrationFieldMapping_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "IntegrationConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationEvent" ADD CONSTRAINT "IntegrationEvent_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "IntegrationConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationSyncRun" ADD CONSTRAINT "IntegrationSyncRun_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "IntegrationConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "IntegrationConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdPerformanceDaily" ADD CONSTRAINT "AdPerformanceDaily_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdPerformanceDaily" ADD CONSTRAINT "AdPerformanceDaily_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributionTouch" ADD CONSTRAINT "AttributionTouch_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributionTouch" ADD CONSTRAINT "AttributionTouch_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributionTouch" ADD CONSTRAINT "AttributionTouch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributionTouch" ADD CONSTRAINT "AttributionTouch_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversionEvent" ADD CONSTRAINT "ConversionEvent_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "IntegrationConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversionEvent" ADD CONSTRAINT "ConversionEvent_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversionEvent" ADD CONSTRAINT "ConversionEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationDefinition" ADD CONSTRAINT "AutomationDefinition_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationDefinition" ADD CONSTRAINT "AutomationDefinition_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationExecution" ADD CONSTRAINT "AutomationExecution_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "AutomationDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationExecution" ADD CONSTRAINT "AutomationExecution_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationExecution" ADD CONSTRAINT "AutomationExecution_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationExecution" ADD CONSTRAINT "AutomationExecution_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoginEvent" ADD CONSTRAINT "LoginEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportLog" ADD CONSTRAINT "ExportLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
