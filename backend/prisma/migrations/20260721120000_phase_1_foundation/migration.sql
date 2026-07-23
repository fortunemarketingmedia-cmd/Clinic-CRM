-- Phase 1 is additive except for separating Appointment.status from LeadStatus.
-- Legacy LeadStatus values and identity columns are deliberately retained for API compatibility.

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ORGANISATION_OWNER';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'CLINIC_ADMIN';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'BRANCH_MANAGER';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'LEAD_COUNSELLOR';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'DOCTOR';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'THERAPIST';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'BILLING_EXECUTIVE';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'INVENTORY_MANAGER';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'MARKETING_USER';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'AUDITOR';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPPORT_EXECUTIVE';

ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'UNASSIGNED';
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'ASSIGNED';
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'ATTEMPTING_CONTACT';
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'CONNECTED';
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'QUALIFIED';
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'APPOINTMENT_PROPOSED';
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'APPOINTMENT_BOOKED';
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'NURTURING';
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'LOST';
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'DISQUALIFIED';

CREATE TYPE "AppointmentStatus" AS ENUM ('REQUESTED', 'SLOT_PROPOSED', 'SCHEDULED', 'CONFIRMATION_PENDING', 'CONFIRMED', 'CHECKED_IN', 'WAITING', 'IN_CONSULTATION', 'TREATMENT_IN_PROGRESS', 'BILLING_PENDING', 'COMPLETED', 'RESCHEDULED', 'CANCELLED', 'NO_SHOW');
CREATE TYPE "PersonRecordStatus" AS ENUM ('ACTIVE', 'POSSIBLE_DUPLICATE', 'MERGED', 'ARCHIVED');
CREATE TYPE "PreferredChannel" AS ENUM ('CALL', 'WHATSAPP', 'EMAIL', 'SMS', 'NONE');
CREATE TYPE "ActivityChannel" AS ENUM ('CALL', 'WHATSAPP', 'EMAIL', 'SMS', 'IN_PERSON', 'INTERNAL');
CREATE TYPE "ActivityDirection" AS ENUM ('INBOUND', 'OUTBOUND', 'INTERNAL');
CREATE TYPE "WorkPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "WorkStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'OVERDUE');

ALTER TABLE "Appointment" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Appointment"
  ALTER COLUMN "status" TYPE "AppointmentStatus"
  USING (
    CASE "status"::text
      WHEN 'NEW' THEN 'REQUESTED'
      WHEN 'BOOKED' THEN 'SCHEDULED'
      WHEN 'CONFIRMED' THEN 'CONFIRMED'
      WHEN 'ARRIVED' THEN 'CHECKED_IN'
      WHEN 'CANCELLED' THEN 'CANCELLED'
      WHEN 'POSTPONED' THEN 'RESCHEDULED'
      WHEN 'NOT_ARRIVED' THEN 'NO_SHOW'
      WHEN 'CONVERTED' THEN 'COMPLETED'
      ELSE 'SCHEDULED'
    END
  )::"AppointmentStatus";
ALTER TABLE "Appointment" ALTER COLUMN "status" SET DEFAULT 'SCHEDULED';

CREATE TABLE "Person" (
  "id" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "primaryMobile" TEXT NOT NULL,
  "normalizedMobile" TEXT NOT NULL,
  "alternateMobile" TEXT,
  "normalizedAlternateMobile" TEXT,
  "email" TEXT,
  "normalizedEmail" TEXT,
  "dateOfBirth" TIMESTAMP(3),
  "sex" "Sex",
  "address" TEXT,
  "city" TEXT,
  "state" TEXT,
  "pinCode" TEXT,
  "emergencyContactName" TEXT,
  "emergencyContactMobile" TEXT,
  "guardianName" TEXT,
  "guardianMobile" TEXT,
  "guardianRelationship" TEXT,
  "preferredLanguage" TEXT,
  "preferredChannel" "PreferredChannel",
  "preferredBranchId" TEXT,
  "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
  "transactionalConsent" BOOLEAN NOT NULL DEFAULT false,
  "appointmentNotificationConsent" BOOLEAN NOT NULL DEFAULT false,
  "dataProcessingConsent" BOOLEAN NOT NULL DEFAULT false,
  "duplicateConfidence" DECIMAL(5,2),
  "recordStatus" "PersonRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "mergedIntoId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Lead" ADD COLUMN "personId" TEXT;
ALTER TABLE "Lead" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "Lead" ADD COLUMN "nextAction" TEXT;
ALTER TABLE "Lead" ADD COLUMN "nextActionDueAt" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN "qualificationStatus" TEXT;
ALTER TABLE "Lead" ADD COLUMN "qualificationNotes" TEXT;
ALTER TABLE "Lead" ADD COLUMN "leadScore" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Lead" ADD COLUMN "lostReason" TEXT;
ALTER TABLE "Lead" ADD COLUMN "lostNotes" TEXT;
ALTER TABLE "Lead" ADD COLUMN "disqualificationReason" TEXT;
ALTER TABLE "Lead" ADD COLUMN "convertedAt" TIMESTAMP(3);
ALTER TABLE "Patient" ADD COLUMN "personId" TEXT;
ALTER TABLE "TimelineEvent" ADD COLUMN "personId" TEXT;

-- Patient identity wins when a lead has already converted.
INSERT INTO "Person" (
  "id", "fullName", "primaryMobile", "normalizedMobile", "email", "normalizedEmail",
  "sex", "address", "preferredBranchId", "createdAt", "updatedAt"
)
SELECT
  'person_' || md5('patient:' || p."id"), p."fullName", p."mobile",
  right(regexp_replace(p."mobile", '[^0-9]', '', 'g'), 10), p."email", lower(trim(p."email")),
  p."sex", p."address", p."branchId", p."createdAt", CURRENT_TIMESTAMP
FROM "Patient" p;

UPDATE "Patient" p
SET "personId" = 'person_' || md5('patient:' || p."id");

UPDATE "Lead" l
SET "personId" = p."personId"
FROM "Patient" p
WHERE p."leadId" = l."id";

-- Reuse a patient Person for exact normalised contact matches. This is a link, not a merge.
UPDATE "Lead" l
SET "personId" = matched."personId"
FROM (
  SELECT DISTINCT ON (right(regexp_replace(p."mobile", '[^0-9]', '', 'g'), 10))
    p."personId", right(regexp_replace(p."mobile", '[^0-9]', '', 'g'), 10) AS mobile
  FROM "Patient" p
  WHERE regexp_replace(p."mobile", '[^0-9]', '', 'g') <> ''
  ORDER BY right(regexp_replace(p."mobile", '[^0-9]', '', 'g'), 10), p."createdAt"
) matched
WHERE l."personId" IS NULL
  AND right(regexp_replace(l."mobile", '[^0-9]', '', 'g'), 10) = matched.mobile;

-- Email is a second exact identifier when legacy phone data differs or is absent.
UPDATE "Lead" l
SET "personId" = matched."personId"
FROM (
  SELECT DISTINCT ON (lower(trim(p."email")))
    p."personId", lower(trim(p."email")) AS email
  FROM "Patient" p
  WHERE NULLIF(trim(p."email"), '') IS NOT NULL
  ORDER BY lower(trim(p."email")), p."createdAt"
) matched
WHERE l."personId" IS NULL
  AND NULLIF(trim(l."email"), '') IS NOT NULL
  AND lower(trim(l."email")) = matched.email;

-- Group remaining historical enquiries by exact normalised mobile; fuzzy matches stay separate.
INSERT INTO "Person" (
  "id", "fullName", "primaryMobile", "normalizedMobile", "email", "normalizedEmail",
  "address", "preferredBranchId", "createdAt", "updatedAt"
)
SELECT DISTINCT ON (right(regexp_replace(l."mobile", '[^0-9]', '', 'g'), 10))
  'person_' || md5('lead-mobile:' || right(regexp_replace(l."mobile", '[^0-9]', '', 'g'), 10)),
  l."name", l."mobile", right(regexp_replace(l."mobile", '[^0-9]', '', 'g'), 10), l."email",
  lower(trim(l."email")), l."address", l."branchId", l."createdAt", CURRENT_TIMESTAMP
FROM "Lead" l
WHERE l."personId" IS NULL
ORDER BY right(regexp_replace(l."mobile", '[^0-9]', '', 'g'), 10), l."createdAt";

UPDATE "Lead" l
SET "personId" = 'person_' || md5('lead-mobile:' || right(regexp_replace(l."mobile", '[^0-9]', '', 'g'), 10))
WHERE l."personId" IS NULL;

UPDATE "Lead"
SET "ownerId" = "createdById",
    "nextAction" = COALESCE(NULLIF("followupNotes", ''), 'Initial contact'),
    "nextActionDueAt" = COALESCE("nextFollowupAt", "createdAt"),
    "convertedAt" = CASE WHEN "status" = 'CONVERTED' THEN "updatedAt" ELSE NULL END;

CREATE TABLE "UserBranch" (
  "userId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserBranch_pkey" PRIMARY KEY ("userId", "branchId")
);

-- Preserve existing branch-switching behaviour. Administrators can later narrow staff assignments.
INSERT INTO "UserBranch" ("userId", "branchId", "isPrimary")
SELECT u."id", b."id", false FROM "User" u CROSS JOIN "Branch" b;

CREATE TABLE "FollowUp" (
  "id" TEXT NOT NULL, "personId" TEXT NOT NULL, "leadId" TEXT, "patientId" TEXT,
  "assignedUserId" TEXT NOT NULL, "branchId" TEXT NOT NULL, "activityType" TEXT NOT NULL,
  "channel" "ActivityChannel" NOT NULL, "direction" "ActivityDirection" NOT NULL DEFAULT 'OUTBOUND',
  "dueAt" TIMESTAMP(3) NOT NULL, "completedAt" TIMESTAMP(3), "outcome" TEXT, "notes" TEXT,
  "nextAction" TEXT, "nextFollowUpAt" TIMESTAMP(3), "reminderAt" TIMESTAMP(3),
  "priority" "WorkPriority" NOT NULL DEFAULT 'MEDIUM', "status" "WorkStatus" NOT NULL DEFAULT 'OPEN',
  "escalationStatus" TEXT, "source" TEXT, "relatedAppointmentId" TEXT,
  "createdById" TEXT NOT NULL, "completedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FollowUp_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Task" (
  "id" TEXT NOT NULL, "title" TEXT NOT NULL, "description" TEXT, "type" TEXT NOT NULL,
  "priority" "WorkPriority" NOT NULL DEFAULT 'MEDIUM', "assignedUserId" TEXT NOT NULL,
  "assignedTeam" TEXT, "branchId" TEXT NOT NULL, "personId" TEXT, "leadId" TEXT,
  "patientId" TEXT, "relatedAppointmentId" TEXT, "dueAt" TIMESTAMP(3) NOT NULL,
  "reminderAt" TIMESTAMP(3), "status" "WorkStatus" NOT NULL DEFAULT 'OPEN',
  "completionNotes" TEXT, "automaticallyCreated" BOOLEAN NOT NULL DEFAULT false,
  "escalationStatus" TEXT, "createdById" TEXT NOT NULL, "completedById" TEXT,
  "completedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CallLog" (
  "id" TEXT NOT NULL, "personId" TEXT NOT NULL, "leadId" TEXT, "patientId" TEXT,
  "branchId" TEXT NOT NULL, "userId" TEXT NOT NULL, "direction" "ActivityDirection" NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL, "endedAt" TIMESTAMP(3), "outcome" TEXT NOT NULL,
  "notes" TEXT, "nextAction" TEXT, "nextFollowUpAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "CallLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL, "userId" TEXT, "action" TEXT NOT NULL, "entity" TEXT NOT NULL,
  "entityId" TEXT, "previousValue" JSONB, "newValue" JSONB, "branchId" TEXT,
  "ipAddress" TEXT, "device" TEXT, "correlationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MedicalProfileVersion" (
  "id" TEXT NOT NULL, "medicalProfileId" TEXT NOT NULL, "previousValue" JSONB,
  "updatedValue" JSONB NOT NULL, "reason" TEXT, "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MedicalProfileVersion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Person_normalizedMobile_idx" ON "Person"("normalizedMobile");
CREATE INDEX "Person_normalizedEmail_idx" ON "Person"("normalizedEmail");
CREATE INDEX "Person_normalizedAlternateMobile_idx" ON "Person"("normalizedAlternateMobile");
CREATE INDEX "Person_recordStatus_idx" ON "Person"("recordStatus");
CREATE INDEX "Person_preferredBranchId_idx" ON "Person"("preferredBranchId");
CREATE INDEX "Lead_personId_idx" ON "Lead"("personId");
CREATE INDEX "Lead_ownerId_status_idx" ON "Lead"("ownerId", "status");
CREATE INDEX "Lead_nextActionDueAt_idx" ON "Lead"("nextActionDueAt");
CREATE UNIQUE INDEX "Patient_personId_key" ON "Patient"("personId");
CREATE INDEX "TimelineEvent_personId_createdAt_idx" ON "TimelineEvent"("personId", "createdAt");
CREATE INDEX "UserBranch_branchId_idx" ON "UserBranch"("branchId");
CREATE INDEX "FollowUp_assignedUserId_status_dueAt_idx" ON "FollowUp"("assignedUserId", "status", "dueAt");
CREATE INDEX "FollowUp_branchId_status_dueAt_idx" ON "FollowUp"("branchId", "status", "dueAt");
CREATE INDEX "FollowUp_leadId_idx" ON "FollowUp"("leadId");
CREATE INDEX "FollowUp_patientId_idx" ON "FollowUp"("patientId");
CREATE INDEX "FollowUp_personId_idx" ON "FollowUp"("personId");
CREATE INDEX "Task_assignedUserId_status_dueAt_idx" ON "Task"("assignedUserId", "status", "dueAt");
CREATE INDEX "Task_branchId_status_dueAt_idx" ON "Task"("branchId", "status", "dueAt");
CREATE INDEX "Task_leadId_idx" ON "Task"("leadId");
CREATE INDEX "Task_patientId_idx" ON "Task"("patientId");
CREATE INDEX "CallLog_personId_startedAt_idx" ON "CallLog"("personId", "startedAt");
CREATE INDEX "CallLog_leadId_startedAt_idx" ON "CallLog"("leadId", "startedAt");
CREATE INDEX "CallLog_branchId_startedAt_idx" ON "CallLog"("branchId", "startedAt");
CREATE INDEX "AuditLog_entity_entityId_createdAt_idx" ON "AuditLog"("entity", "entityId", "createdAt");
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");
CREATE INDEX "AuditLog_branchId_createdAt_idx" ON "AuditLog"("branchId", "createdAt");
CREATE INDEX "AuditLog_correlationId_idx" ON "AuditLog"("correlationId");
CREATE INDEX "MedicalProfileVersion_medicalProfileId_createdAt_idx" ON "MedicalProfileVersion"("medicalProfileId", "createdAt");

ALTER TABLE "Person" ADD CONSTRAINT "Person_preferredBranchId_fkey" FOREIGN KEY ("preferredBranchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Person" ADD CONSTRAINT "Person_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserBranch" ADD CONSTRAINT "UserBranch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserBranch" ADD CONSTRAINT "UserBranch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_relatedAppointmentId_fkey" FOREIGN KEY ("relatedAppointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_relatedAppointmentId_fkey" FOREIGN KEY ("relatedAppointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CallLog" ADD CONSTRAINT "CallLog_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CallLog" ADD CONSTRAINT "CallLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CallLog" ADD CONSTRAINT "CallLog_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CallLog" ADD CONSTRAINT "CallLog_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CallLog" ADD CONSTRAINT "CallLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MedicalProfileVersion" ADD CONSTRAINT "MedicalProfileVersion_medicalProfileId_fkey" FOREIGN KEY ("medicalProfileId") REFERENCES "MedicalProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MedicalProfileVersion" ADD CONSTRAINT "MedicalProfileVersion_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Rollback outline:
-- 1. Convert Appointment.status back to LeadStatus using the inverse CASE mapping.
-- 2. Drop the new foreign keys, indexes, tables, and columns.
-- 3. Drop the new enums. Existing Lead/Patient source rows remain untouched.
