CREATE TYPE "AdPlatform" AS ENUM ('GOOGLE', 'META');

CREATE TABLE "AdLead" (
    "id" TEXT NOT NULL,
    "platform" "AdPlatform" NOT NULL,
    "externalLeadId" TEXT,
    "name" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "email" TEXT,
    "campaignId" TEXT,
    "campaignName" TEXT,
    "adSetId" TEXT,
    "adSetName" TEXT,
    "adId" TEXT,
    "adName" TEXT,
    "formId" TEXT,
    "formName" TEXT,
    "rawPayload" JSONB,
    "branchId" TEXT,
    "leadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdLead_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdLead_platform_idx" ON "AdLead"("platform");
CREATE INDEX "AdLead_branchId_idx" ON "AdLead"("branchId");
CREATE INDEX "AdLead_mobile_idx" ON "AdLead"("mobile");
CREATE INDEX "AdLead_createdAt_idx" ON "AdLead"("createdAt");

ALTER TABLE "AdLead" ADD CONSTRAINT "AdLead_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdLead" ADD CONSTRAINT "AdLead_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
