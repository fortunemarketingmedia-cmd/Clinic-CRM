-- Phase 2: CRM scoring, interval scheduling, front-desk queues, waitlist, and availability.
-- Existing appointmentAt and roomNumber columns remain for backward compatibility.

CREATE TYPE "LeadScoreCategory" AS ENUM ('HOT', 'WARM', 'COLD', 'UNQUALIFIED');
CREATE TYPE "ScoreRuleOperator" AS ENUM ('EQUALS', 'CONTAINS', 'EXISTS', 'GREATER_THAN', 'LESS_THAN');
CREATE TYPE "ClinicResourceType" AS ENUM ('ROOM', 'EQUIPMENT', 'TREATMENT_CHAIR', 'OTHER');
CREATE TYPE "WaitlistStatus" AS ENUM ('ACTIVE', 'NOTIFIED', 'ACCEPTED', 'DECLINED', 'BOOKED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "ScheduleExceptionType" AS ENUM ('BREAK', 'LEAVE', 'HOLIDAY', 'BLOCKED');

ALTER TABLE "Lead" ADD COLUMN "scoreCategory" "LeadScoreCategory" NOT NULL DEFAULT 'COLD';

ALTER TABLE "Appointment" ADD COLUMN "endAt" TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN "durationMinutes" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "Appointment" ADD COLUMN "bufferMinutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Appointment" ADD COLUMN "serviceId" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "doctorId" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "therapistId" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "counsellorId" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "resourceId" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "equipmentId" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "bookingSource" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "bookingChannel" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "confirmationStatus" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "reminderStatus" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "intakeFormStatus" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "consentStatus" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "advancePaymentStatus" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "arrivalAt" TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN "checkInAt" TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN "waitingStartedAt" TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN "consultationStartedAt" TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN "consultationCompletedAt" TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN "treatmentStartedAt" TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN "treatmentCompletedAt" TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN "checkoutAt" TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN "cancellationReason" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "noShowReason" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "rescheduleReason" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "rescheduleCount" INTEGER NOT NULL DEFAULT 0;

UPDATE "Appointment"
SET "endAt" = "appointmentAt" + ("durationMinutes" * INTERVAL '1 minute')
WHERE "endAt" IS NULL;

CREATE TABLE "ClinicService" (
  "id" TEXT NOT NULL,
  "branchId" TEXT,
  "name" TEXT NOT NULL,
  "category" TEXT,
  "durationMinutes" INTEGER NOT NULL DEFAULT 30,
  "bufferMinutes" INTEGER NOT NULL DEFAULT 0,
  "resourceType" "AppointmentResource" NOT NULL DEFAULT 'CONSULTATION',
  "advancePaymentRequired" BOOLEAN NOT NULL DEFAULT false,
  "bookingNoticeMinutes" INTEGER NOT NULL DEFAULT 0,
  "cancellationWindowMinutes" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClinicService_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClinicResource" (
  "id" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "ClinicResourceType" NOT NULL,
  "serialNumber" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClinicResource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StaffSchedule" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "weekday" INTEGER NOT NULL,
  "startMinutes" INTEGER NOT NULL,
  "endMinutes" INTEGER NOT NULL,
  "effectiveFrom" TIMESTAMP(3),
  "effectiveTo" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StaffSchedule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScheduleException" (
  "id" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "userId" TEXT,
  "resourceId" TEXT,
  "type" "ScheduleExceptionType" NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScheduleException_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WaitlistEntry" (
  "id" TEXT NOT NULL,
  "personId" TEXT NOT NULL,
  "patientId" TEXT,
  "branchId" TEXT NOT NULL,
  "serviceId" TEXT,
  "requestedService" TEXT NOT NULL,
  "preferredDoctorId" TEXT,
  "preferredFrom" TIMESTAMP(3) NOT NULL,
  "preferredTo" TIMESTAMP(3) NOT NULL,
  "preferredTimeFrom" INTEGER,
  "preferredTimeTo" INTEGER,
  "priority" "WorkPriority" NOT NULL DEFAULT 'MEDIUM',
  "notes" TEXT,
  "expiresAt" TIMESTAMP(3),
  "contactStatus" TEXT,
  "status" "WaitlistStatus" NOT NULL DEFAULT 'ACTIVE',
  "assignedUserId" TEXT,
  "notifiedAt" TIMESTAMP(3),
  "respondedAt" TIMESTAMP(3),
  "appointmentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeadScoringRule" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "branchId" TEXT,
  "field" TEXT NOT NULL,
  "operator" "ScoreRuleOperator" NOT NULL,
  "value" TEXT,
  "points" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LeadScoringRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeadScoreHistory" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "previousScore" INTEGER NOT NULL,
  "newScore" INTEGER NOT NULL,
  "category" "LeadScoreCategory" NOT NULL,
  "reasons" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadScoreHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClinicService_branchId_name_key" ON "ClinicService"("branchId", "name");
CREATE INDEX "ClinicService_active_idx" ON "ClinicService"("active");
CREATE UNIQUE INDEX "ClinicResource_branchId_name_key" ON "ClinicResource"("branchId", "name");
CREATE INDEX "ClinicResource_branchId_type_active_idx" ON "ClinicResource"("branchId", "type", "active");
CREATE UNIQUE INDEX "StaffSchedule_user_branch_weekday_time_key" ON "StaffSchedule"("userId", "branchId", "weekday", "startMinutes", "endMinutes");
CREATE INDEX "StaffSchedule_branchId_weekday_active_idx" ON "StaffSchedule"("branchId", "weekday", "active");
CREATE INDEX "ScheduleException_branchId_startsAt_endsAt_idx" ON "ScheduleException"("branchId", "startsAt", "endsAt");
CREATE INDEX "ScheduleException_userId_startsAt_endsAt_idx" ON "ScheduleException"("userId", "startsAt", "endsAt");
CREATE INDEX "ScheduleException_resourceId_startsAt_endsAt_idx" ON "ScheduleException"("resourceId", "startsAt", "endsAt");
CREATE INDEX "WaitlistEntry_branchId_status_preferredFrom_idx" ON "WaitlistEntry"("branchId", "status", "preferredFrom");
CREATE INDEX "WaitlistEntry_personId_idx" ON "WaitlistEntry"("personId");
CREATE INDEX "WaitlistEntry_serviceId_status_idx" ON "WaitlistEntry"("serviceId", "status");
CREATE INDEX "LeadScoringRule_branchId_active_idx" ON "LeadScoringRule"("branchId", "active");
CREATE INDEX "LeadScoringRule_field_active_idx" ON "LeadScoringRule"("field", "active");
CREATE INDEX "LeadScoreHistory_leadId_createdAt_idx" ON "LeadScoreHistory"("leadId", "createdAt");
CREATE INDEX "Appointment_doctorId_appointmentAt_endAt_idx" ON "Appointment"("doctorId", "appointmentAt", "endAt");
CREATE INDEX "Appointment_therapistId_appointmentAt_endAt_idx" ON "Appointment"("therapistId", "appointmentAt", "endAt");
CREATE INDEX "Appointment_resourceId_appointmentAt_endAt_idx" ON "Appointment"("resourceId", "appointmentAt", "endAt");
CREATE INDEX "Appointment_equipmentId_appointmentAt_endAt_idx" ON "Appointment"("equipmentId", "appointmentAt", "endAt");

ALTER TABLE "ClinicService" ADD CONSTRAINT "ClinicService_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClinicResource" ADD CONSTRAINT "ClinicResource_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StaffSchedule" ADD CONSTRAINT "StaffSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffSchedule" ADD CONSTRAINT "StaffSchedule_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduleException" ADD CONSTRAINT "ScheduleException_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduleException" ADD CONSTRAINT "ScheduleException_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduleException" ADD CONSTRAINT "ScheduleException_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "ClinicResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ClinicService"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_preferredDoctorId_fkey" FOREIGN KEY ("preferredDoctorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LeadScoringRule" ADD CONSTRAINT "LeadScoringRule_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LeadScoreHistory" ADD CONSTRAINT "LeadScoreHistory_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ClinicService"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_therapistId_fkey" FOREIGN KEY ("therapistId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_counsellorId_fkey" FOREIGN KEY ("counsellorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "ClinicResource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "ClinicResource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed a global consultation service and branch rooms so historical roomNumber values can be linked.
INSERT INTO "ClinicService" ("id", "name", "category", "durationMinutes", "bufferMinutes", "resourceType", "updatedAt")
VALUES ('service_consultation', 'Consultation', 'Consultation', 30, 0, 'CONSULTATION', CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

UPDATE "Appointment" SET "serviceId" = 'service_consultation' WHERE "serviceId" IS NULL;

INSERT INTO "ClinicResource" ("id", "branchId", "name", "type", "updatedAt")
SELECT 'room_' || md5(b."id" || ':' || room.number::text), b."id", 'Treatment Room ' || room.number, 'ROOM', CURRENT_TIMESTAMP
FROM "Branch" b CROSS JOIN (VALUES (1), (2), (3), (4)) AS room(number)
ON CONFLICT DO NOTHING;

UPDATE "Appointment" a
SET "resourceId" = 'room_' || md5(a."branchId" || ':' || a."roomNumber"::text)
WHERE a."roomNumber" IS NOT NULL AND a."resourceId" IS NULL;

-- Default scoring rules are intentionally generic and contain no clinical diagnosis data.
INSERT INTO "LeadScoringRule" ("id", "name", "description", "field", "operator", "value", "points", "updatedAt") VALUES
  ('score_response', 'Response received', 'Lead has been contacted successfully', 'lastContactedAt', 'EXISTS', NULL, 15, CURRENT_TIMESTAMP),
  ('score_appointment', 'Appointment booked', 'Lead has a linked appointment', 'appointmentCount', 'GREATER_THAN', '0', 30, CURRENT_TIMESTAMP),
  ('score_returning', 'Returning person', 'Person has more than one enquiry', 'personLeadCount', 'GREATER_THAN', '1', 10, CURRENT_TIMESTAMP),
  ('score_high_priority', 'High priority', 'High or urgent priority lead', 'priority', 'EQUALS', 'HIGH,URGENT', 20, CURRENT_TIMESTAMP),
  ('score_inactive', 'Inactive for seven days', 'No update for more than seven days', 'daysInactive', 'GREATER_THAN', '7', -15, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

-- Rollback: drop new foreign keys/indexes/tables, remove additive Appointment/Lead columns,
-- and finally drop the five Phase 2 enums. Existing appointmentAt/roomNumber data is unchanged.
