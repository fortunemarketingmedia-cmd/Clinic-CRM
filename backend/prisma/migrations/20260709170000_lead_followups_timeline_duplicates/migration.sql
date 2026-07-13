CREATE TYPE "LeadPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

ALTER TABLE "Lead"
  ADD COLUMN "email" TEXT,
  ADD COLUMN "priority" "LeadPriority" NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN "nextFollowupAt" TIMESTAMP(3),
  ADD COLUMN "lastContactedAt" TIMESTAMP(3),
  ADD COLUMN "followupNotes" TEXT,
  ADD COLUMN "interestedTreatment" TEXT;

ALTER TABLE "Patient"
  ADD COLUMN "email" TEXT;

CREATE TABLE "TimelineEvent" (
  "id" TEXT NOT NULL,
  "leadId" TEXT,
  "patientId" TEXT,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "metadata" JSONB,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TimelineEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Lead_email_idx" ON "Lead"("email");
CREATE INDEX "Lead_nextFollowupAt_idx" ON "Lead"("nextFollowupAt");
CREATE INDEX "Patient_email_idx" ON "Patient"("email");
CREATE INDEX "TimelineEvent_leadId_createdAt_idx" ON "TimelineEvent"("leadId", "createdAt");
CREATE INDEX "TimelineEvent_patientId_createdAt_idx" ON "TimelineEvent"("patientId", "createdAt");

ALTER TABLE "TimelineEvent"
  ADD CONSTRAINT "TimelineEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TimelineEvent"
  ADD CONSTRAINT "TimelineEvent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TimelineEvent"
  ADD CONSTRAINT "TimelineEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
