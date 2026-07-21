CREATE TYPE "AppointmentResource" AS ENUM ('CONSULTATION', 'TREATMENT_ROOM');

ALTER TABLE "Appointment"
ADD COLUMN "resourceType" "AppointmentResource" NOT NULL DEFAULT 'CONSULTATION',
ADD COLUMN "roomNumber" INTEGER;

ALTER TABLE "Appointment"
ADD CONSTRAINT "Appointment_roomNumber_check" CHECK ("roomNumber" IS NULL OR ("roomNumber" >= 1 AND "roomNumber" <= 4));

CREATE INDEX "Appointment_branchId_roomNumber_appointmentAt_idx"
ON "Appointment"("branchId", "roomNumber", "appointmentAt");
