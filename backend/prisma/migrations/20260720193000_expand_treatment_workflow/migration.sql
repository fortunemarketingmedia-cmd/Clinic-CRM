CREATE TYPE "TreatmentType" AS ENUM ('CONSULTATION', 'VIDEO_CONSULTATION', 'TREATMENT_ROOM', 'PROCEDURE', 'FOLLOW_UP', 'OTHER');

ALTER TABLE "Session"
ADD COLUMN "appointmentId" TEXT,
ADD COLUMN "treatmentType" "TreatmentType" NOT NULL DEFAULT 'CONSULTATION',
ADD COLUMN "chiefComplaint" TEXT,
ADD COLUMN "diagnosis" TEXT,
ADD COLUMN "prescription" JSONB;

CREATE UNIQUE INDEX "Session_appointmentId_key" ON "Session"("appointmentId");
CREATE INDEX "Session_appointmentId_idx" ON "Session"("appointmentId");

ALTER TABLE "Session"
ADD CONSTRAINT "Session_appointmentId_fkey"
FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
