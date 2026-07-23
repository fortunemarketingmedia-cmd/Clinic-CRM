-- CreateEnum
CREATE TYPE "WhatsAppAccountStatus" AS ENUM ('DISCONNECTED', 'CONNECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "WhatsAppConversationStatus" AS ENUM ('NEW', 'OPEN', 'WAITING_FOR_PATIENT', 'WAITING_FOR_CLINIC', 'RESOLVED', 'CLOSED', 'SPAM');

-- CreateEnum
CREATE TYPE "CommunicationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "WhatsAppMessageDirection" AS ENUM ('INBOUND', 'OUTBOUND', 'INTERNAL');

-- CreateEnum
CREATE TYPE "WhatsAppMessageType" AS ENUM ('TEXT', 'IMAGE', 'DOCUMENT', 'AUDIO', 'LOCATION', 'BUTTON', 'TEMPLATE', 'INTERACTIVE', 'INTERNAL_NOTE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "WhatsAppMessageStatus" AS ENUM ('SCHEDULED', 'QUEUED', 'SUBMITTED', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'CANCELLED', 'RECEIVED');

-- CreateEnum
CREATE TYPE "WhatsAppTemplateStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PAUSED', 'DISABLED');

-- CreateEnum
CREATE TYPE "WhatsAppTemplateGroup" AS ENUM ('NEW_LEAD', 'LEAD_FOLLOW_UP', 'APPOINTMENT', 'CONSULTATION', 'TREATMENT', 'PRESCRIPTION', 'PAYMENT', 'PACKAGE', 'FEEDBACK', 'REACTIVATION', 'SUPPORT', 'GENERAL');

-- CreateEnum
CREATE TYPE "WhatsAppMessageCategory" AS ENUM ('AUTHENTICATION', 'MARKETING', 'UTILITY', 'SERVICE');

-- CreateEnum
CREATE TYPE "WhatsAppConsentCategory" AS ENUM ('TRANSACTIONAL', 'APPOINTMENT_NOTIFICATIONS', 'TREATMENT_FOLLOW_UPS', 'PAYMENT_REMINDERS', 'MARKETING_MESSAGES', 'PROMOTIONAL_BROADCASTS');

-- CreateEnum
CREATE TYPE "WhatsAppBroadcastStatus" AS ENUM ('DRAFT', 'APPROVAL_PENDING', 'APPROVED', 'SCHEDULED', 'SENDING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WhatsAppRecipientStatus" AS ENUM ('FILTERED', 'QUEUED', 'SUBMITTED', 'DELIVERED', 'READ', 'REPLIED', 'FAILED', 'OPTED_OUT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WhatsAppAutomationTrigger" AS ENUM ('LEAD_RECEIVED', 'LEAD_FOLLOW_UP', 'APPOINTMENT_BOOKED', 'APPOINTMENT_CONFIRMATION', 'APPOINTMENT_TOMORROW', 'APPOINTMENT_IN_ONE_HOUR', 'APPOINTMENT_RESCHEDULED', 'APPOINTMENT_CANCELLED', 'APPOINTMENT_MISSED', 'PATIENT_CHECKED_IN', 'CONSULTATION_COMPLETED', 'POST_TREATMENT_FOLLOW_UP', 'AFTERCARE_INSTRUCTIONS', 'PRESCRIPTION_AVAILABLE', 'INVOICE_GENERATED', 'PAYMENT_PENDING', 'PAYMENT_RECEIVED', 'PACKAGE_PURCHASED', 'SESSIONS_REMAINING', 'PACKAGE_NEARING_EXPIRY', 'PACKAGE_EXPIRED', 'TREATMENT_FOLLOW_UP_DUE', 'FEEDBACK_REQUEST', 'REVIEW_REQUEST', 'DORMANT_PATIENT_REACTIVATION', 'SUPPORT_TICKET_UPDATE', 'REFUND_PROCESSED');

-- CreateEnum
CREATE TYPE "WhatsAppWebhookStatus" AS ENUM ('RECEIVED', 'QUEUED', 'PROCESSING', 'PROCESSED', 'FAILED', 'DUPLICATE');

-- CreateEnum
CREATE TYPE "DurableJobType" AS ENUM ('WHATSAPP_SEND', 'WHATSAPP_WEBHOOK_PROCESS', 'WHATSAPP_APPOINTMENT_AUTOMATION', 'WHATSAPP_LEAD_AUTOMATION', 'WHATSAPP_BROADCAST');

-- CreateEnum
CREATE TYPE "DurableJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'RETRY', 'COMPLETED', 'DEAD', 'CANCELLED');

-- CreateTable
CREATE TABLE "WhatsAppAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "businessAccountId" TEXT NOT NULL,
    "appId" TEXT,
    "accessTokenCiphertext" TEXT NOT NULL,
    "appSecretCiphertext" TEXT NOT NULL,
    "verifyTokenCiphertext" TEXT NOT NULL,
    "status" "WhatsAppAccountStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "apiVersion" TEXT NOT NULL DEFAULT 'v23.0',
    "tokenExpiresAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "lastFailureReason" TEXT,
    "webhookVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppPhoneNumber" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "displayPhoneNumber" TEXT NOT NULL,
    "normalizedPhone" TEXT NOT NULL,
    "verifiedName" TEXT,
    "qualityRating" TEXT,
    "messagingLimit" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppPhoneNumber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppConversation" (
    "id" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "normalizedMobile" TEXT NOT NULL,
    "contactName" TEXT,
    "personId" TEXT,
    "leadId" TEXT,
    "patientId" TEXT,
    "appointmentId" TEXT,
    "invoiceId" TEXT,
    "packageId" TEXT,
    "supportTicketId" TEXT,
    "branchId" TEXT NOT NULL,
    "assignedToId" TEXT,
    "status" "WhatsAppConversationStatus" NOT NULL DEFAULT 'NEW',
    "priority" "CommunicationPriority" NOT NULL DEFAULT 'NORMAL',
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastInboundAt" TIMESTAMP(3),
    "lastOutboundAt" TIMESTAMP(3),
    "sessionExpiresAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "direction" "WhatsAppMessageDirection" NOT NULL,
    "type" "WhatsAppMessageType" NOT NULL,
    "status" "WhatsAppMessageStatus" NOT NULL DEFAULT 'QUEUED',
    "providerMessageId" TEXT,
    "sender" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "content" TEXT,
    "mediaId" TEXT,
    "mediaUrl" TEXT,
    "mimeType" TEXT,
    "filename" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "templateId" TEXT,
    "templateName" TEXT,
    "templateLanguage" TEXT,
    "category" "WhatsAppMessageCategory" NOT NULL DEFAULT 'SERVICE',
    "relatedRecordType" TEXT,
    "relatedRecordId" TEXT,
    "replyToId" TEXT,
    "interactivePayload" JSONB,
    "providerPayload" JSONB,
    "scheduledAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "failureReason" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "costMetadata" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppTemplate" (
    "id" TEXT NOT NULL,
    "accountId" TEXT,
    "branchId" TEXT,
    "providerTemplateId" TEXT,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "category" "WhatsAppMessageCategory" NOT NULL,
    "group" "WhatsAppTemplateGroup" NOT NULL,
    "status" "WhatsAppTemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "headerType" TEXT,
    "headerContent" TEXT,
    "body" TEXT NOT NULL,
    "footer" TEXT,
    "buttons" JSONB,
    "variables" JSONB,
    "rejectionReason" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "deliveredCount" INTEGER NOT NULL DEFAULT 0,
    "readCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "lastSyncedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppWebhookEvent" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "eventHash" TEXT NOT NULL,
    "objectType" TEXT,
    "providerEventId" TEXT,
    "signature" TEXT NOT NULL,
    "signatureVerified" BOOLEAN NOT NULL,
    "status" "WhatsAppWebhookStatus" NOT NULL DEFAULT 'RECEIVED',
    "payload" JSONB NOT NULL,
    "processingAttempts" INTEGER NOT NULL DEFAULT 0,
    "processedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppOptIn" (
    "id" TEXT NOT NULL,
    "personId" TEXT,
    "phoneNumber" TEXT NOT NULL,
    "normalizedPhone" TEXT NOT NULL,
    "category" "WhatsAppConsentCategory" NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL,
    "consentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consentTextVersion" TEXT NOT NULL,
    "ipAddress" TEXT,
    "withdrawnAt" TIMESTAMP(3),
    "withdrawalReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppOptIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppBroadcast" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "branchId" TEXT,
    "templateId" TEXT NOT NULL,
    "status" "WhatsAppBroadcastStatus" NOT NULL DEFAULT 'DRAFT',
    "segmentation" JSONB NOT NULL,
    "variableDefaults" JSONB,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "filteredCount" INTEGER NOT NULL DEFAULT 0,
    "submittedCount" INTEGER NOT NULL DEFAULT 0,
    "deliveredCount" INTEGER NOT NULL DEFAULT 0,
    "readCount" INTEGER NOT NULL DEFAULT 0,
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "optOutCount" INTEGER NOT NULL DEFAULT 0,
    "quietHoursStart" INTEGER NOT NULL DEFAULT 1260,
    "quietHoursEnd" INTEGER NOT NULL DEFAULT 540,
    "rateLimitPerMinute" INTEGER NOT NULL DEFAULT 60,
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppBroadcast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppBroadcastRecipient" (
    "id" TEXT NOT NULL,
    "broadcastId" TEXT NOT NULL,
    "personId" TEXT,
    "leadId" TEXT,
    "patientId" TEXT,
    "phoneNumber" TEXT NOT NULL,
    "normalizedPhone" TEXT NOT NULL,
    "status" "WhatsAppRecipientStatus" NOT NULL DEFAULT 'FILTERED',
    "filterReason" TEXT,
    "messageId" TEXT,
    "queuedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "repliedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppBroadcastRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppAutomation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger" "WhatsAppAutomationTrigger" NOT NULL,
    "branchId" TEXT,
    "templateId" TEXT NOT NULL,
    "delayMinutes" INTEGER NOT NULL DEFAULT 0,
    "sequenceStep" INTEGER NOT NULL DEFAULT 1,
    "stopConditions" JSONB,
    "quietHoursStart" INTEGER NOT NULL DEFAULT 1260,
    "quietHoursEnd" INTEGER NOT NULL DEFAULT 540,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppAutomation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppFailureLog" (
    "id" TEXT NOT NULL,
    "accountId" TEXT,
    "messageId" TEXT,
    "jobId" TEXT,
    "operation" TEXT NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT NOT NULL,
    "retryable" BOOLEAN NOT NULL DEFAULT true,
    "payload" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppFailureLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DurableJob" (
    "id" TEXT NOT NULL,
    "type" "DurableJobType" NOT NULL,
    "status" "DurableJobStatus" NOT NULL DEFAULT 'QUEUED',
    "idempotencyKey" TEXT NOT NULL,
    "branchId" TEXT,
    "payload" JSONB NOT NULL,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "lockExpiresAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DurableJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppAccount_businessAccountId_key" ON "WhatsAppAccount"("businessAccountId");

-- CreateIndex
CREATE INDEX "WhatsAppAccount_status_idx" ON "WhatsAppAccount"("status");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppPhoneNumber_phoneNumberId_key" ON "WhatsAppPhoneNumber"("phoneNumberId");

-- CreateIndex
CREATE INDEX "WhatsAppPhoneNumber_branchId_active_idx" ON "WhatsAppPhoneNumber"("branchId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppPhoneNumber_branchId_normalizedPhone_key" ON "WhatsAppPhoneNumber"("branchId", "normalizedPhone");

-- CreateIndex
CREATE INDEX "WhatsAppConversation_branchId_status_lastMessageAt_idx" ON "WhatsAppConversation"("branchId", "status", "lastMessageAt");

-- CreateIndex
CREATE INDEX "WhatsAppConversation_assignedToId_status_lastMessageAt_idx" ON "WhatsAppConversation"("assignedToId", "status", "lastMessageAt");

-- CreateIndex
CREATE INDEX "WhatsAppConversation_personId_idx" ON "WhatsAppConversation"("personId");

-- CreateIndex
CREATE INDEX "WhatsAppConversation_leadId_idx" ON "WhatsAppConversation"("leadId");

-- CreateIndex
CREATE INDEX "WhatsAppConversation_patientId_idx" ON "WhatsAppConversation"("patientId");

-- CreateIndex
CREATE INDEX "WhatsAppConversation_invoiceId_idx" ON "WhatsAppConversation"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppConversation_phoneNumberId_normalizedMobile_key" ON "WhatsAppConversation"("phoneNumberId", "normalizedMobile");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppMessage_providerMessageId_key" ON "WhatsAppMessage"("providerMessageId");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_conversationId_createdAt_idx" ON "WhatsAppMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_status_scheduledAt_idx" ON "WhatsAppMessage"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_relatedRecordType_relatedRecordId_idx" ON "WhatsAppMessage"("relatedRecordType", "relatedRecordId");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_recipient_createdAt_idx" ON "WhatsAppMessage"("recipient", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsAppTemplate_group_status_active_idx" ON "WhatsAppTemplate"("group", "status", "active");

-- CreateIndex
CREATE INDEX "WhatsAppTemplate_branchId_active_idx" ON "WhatsAppTemplate"("branchId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppTemplate_accountId_name_language_key" ON "WhatsAppTemplate"("accountId", "name", "language");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppWebhookEvent_eventHash_key" ON "WhatsAppWebhookEvent"("eventHash");

-- CreateIndex
CREATE INDEX "WhatsAppWebhookEvent_accountId_status_receivedAt_idx" ON "WhatsAppWebhookEvent"("accountId", "status", "receivedAt");

-- CreateIndex
CREATE INDEX "WhatsAppWebhookEvent_providerEventId_idx" ON "WhatsAppWebhookEvent"("providerEventId");

-- CreateIndex
CREATE INDEX "WhatsAppOptIn_normalizedPhone_category_consentedAt_idx" ON "WhatsAppOptIn"("normalizedPhone", "category", "consentedAt");

-- CreateIndex
CREATE INDEX "WhatsAppOptIn_personId_category_idx" ON "WhatsAppOptIn"("personId", "category");

-- CreateIndex
CREATE INDEX "WhatsAppBroadcast_branchId_status_scheduledAt_idx" ON "WhatsAppBroadcast"("branchId", "status", "scheduledAt");

-- CreateIndex
CREATE INDEX "WhatsAppBroadcast_accountId_status_idx" ON "WhatsAppBroadcast"("accountId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppBroadcastRecipient_messageId_key" ON "WhatsAppBroadcastRecipient"("messageId");

-- CreateIndex
CREATE INDEX "WhatsAppBroadcastRecipient_broadcastId_status_idx" ON "WhatsAppBroadcastRecipient"("broadcastId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppBroadcastRecipient_broadcastId_normalizedPhone_key" ON "WhatsAppBroadcastRecipient"("broadcastId", "normalizedPhone");

-- CreateIndex
CREATE INDEX "WhatsAppAutomation_trigger_active_idx" ON "WhatsAppAutomation"("trigger", "active");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppAutomation_trigger_branchId_sequenceStep_key" ON "WhatsAppAutomation"("trigger", "branchId", "sequenceStep");

-- CreateIndex
CREATE INDEX "WhatsAppFailureLog_accountId_occurredAt_idx" ON "WhatsAppFailureLog"("accountId", "occurredAt");

-- CreateIndex
CREATE INDEX "WhatsAppFailureLog_messageId_idx" ON "WhatsAppFailureLog"("messageId");

-- CreateIndex
CREATE INDEX "WhatsAppFailureLog_jobId_idx" ON "WhatsAppFailureLog"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "DurableJob_idempotencyKey_key" ON "DurableJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "DurableJob_status_runAt_idx" ON "DurableJob"("status", "runAt");

-- CreateIndex
CREATE INDEX "DurableJob_branchId_status_runAt_idx" ON "DurableJob"("branchId", "status", "runAt");

-- AddForeignKey
ALTER TABLE "WhatsAppPhoneNumber" ADD CONSTRAINT "WhatsAppPhoneNumber_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "WhatsAppAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppPhoneNumber" ADD CONSTRAINT "WhatsAppPhoneNumber_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppConversation" ADD CONSTRAINT "WhatsAppConversation_phoneNumberId_fkey" FOREIGN KEY ("phoneNumberId") REFERENCES "WhatsAppPhoneNumber"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppConversation" ADD CONSTRAINT "WhatsAppConversation_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppConversation" ADD CONSTRAINT "WhatsAppConversation_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppConversation" ADD CONSTRAINT "WhatsAppConversation_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppConversation" ADD CONSTRAINT "WhatsAppConversation_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppConversation" ADD CONSTRAINT "WhatsAppConversation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppConversation" ADD CONSTRAINT "WhatsAppConversation_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "TreatmentPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppConversation" ADD CONSTRAINT "WhatsAppConversation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppConversation" ADD CONSTRAINT "WhatsAppConversation_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "WhatsAppConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_phoneNumberId_fkey" FOREIGN KEY ("phoneNumberId") REFERENCES "WhatsAppPhoneNumber"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WhatsAppTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "WhatsAppMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppTemplate" ADD CONSTRAINT "WhatsAppTemplate_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "WhatsAppAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppTemplate" ADD CONSTRAINT "WhatsAppTemplate_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppTemplate" ADD CONSTRAINT "WhatsAppTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppWebhookEvent" ADD CONSTRAINT "WhatsAppWebhookEvent_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "WhatsAppAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppOptIn" ADD CONSTRAINT "WhatsAppOptIn_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppBroadcast" ADD CONSTRAINT "WhatsAppBroadcast_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "WhatsAppAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppBroadcast" ADD CONSTRAINT "WhatsAppBroadcast_phoneNumberId_fkey" FOREIGN KEY ("phoneNumberId") REFERENCES "WhatsAppPhoneNumber"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppBroadcast" ADD CONSTRAINT "WhatsAppBroadcast_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppBroadcast" ADD CONSTRAINT "WhatsAppBroadcast_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WhatsAppTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppBroadcast" ADD CONSTRAINT "WhatsAppBroadcast_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppBroadcast" ADD CONSTRAINT "WhatsAppBroadcast_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppBroadcastRecipient" ADD CONSTRAINT "WhatsAppBroadcastRecipient_broadcastId_fkey" FOREIGN KEY ("broadcastId") REFERENCES "WhatsAppBroadcast"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppBroadcastRecipient" ADD CONSTRAINT "WhatsAppBroadcastRecipient_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppBroadcastRecipient" ADD CONSTRAINT "WhatsAppBroadcastRecipient_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppBroadcastRecipient" ADD CONSTRAINT "WhatsAppBroadcastRecipient_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppBroadcastRecipient" ADD CONSTRAINT "WhatsAppBroadcastRecipient_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "WhatsAppMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppAutomation" ADD CONSTRAINT "WhatsAppAutomation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppAutomation" ADD CONSTRAINT "WhatsAppAutomation_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WhatsAppTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppFailureLog" ADD CONSTRAINT "WhatsAppFailureLog_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "WhatsAppAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppFailureLog" ADD CONSTRAINT "WhatsAppFailureLog_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "WhatsAppMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppFailureLog" ADD CONSTRAINT "WhatsAppFailureLog_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "DurableJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DurableJob" ADD CONSTRAINT "DurableJob_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
