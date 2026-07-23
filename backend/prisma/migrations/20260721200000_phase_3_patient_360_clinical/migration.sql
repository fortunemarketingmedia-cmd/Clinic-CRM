-- CreateEnum
CREATE TYPE "EncounterType" AS ENUM ('CONSULTATION', 'VIDEO_CONSULTATION', 'FOLLOW_UP_CONSULTATION', 'PROCEDURE', 'TREATMENT_SESSION', 'REVIEW', 'EMERGENCY_REVIEW', 'OTHER');

-- CreateEnum
CREATE TYPE "EncounterStatus" AS ENUM ('DRAFT', 'COMPLETED', 'SIGNED', 'LOCKED', 'ADDENDUM_ADDED');

-- CreateEnum
CREATE TYPE "TreatmentPlanStatus" AS ENUM ('DRAFT', 'PROPOSED', 'ACCEPTED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PatientAcceptanceStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- Patient lifecycle remains separate from the user-account lifecycle.
CREATE TYPE "PatientStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DECEASED');

-- CreateEnum
CREATE TYPE "ClinicalConsentStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'VERIFIED', 'DECLINED');

-- CreateEnum
CREATE TYPE "ProcedureSessionStatus" AS ENUM ('PLANNED', 'READY', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PrescriptionStatus" AS ENUM ('DRAFT', 'SIGNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MedicineStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "MedicalProfile" ADD COLUMN     "alcoholHistory" TEXT,
ADD COLUMN     "breastfeedingStatus" TEXT,
ADD COLUMN     "clinicalAlerts" TEXT,
ADD COLUMN     "criticalAlert" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "familyHistory" TEXT,
ADD COLUMN     "foodAllergies" TEXT,
ADD COLUMN     "hairProductsUsed" TEXT,
ADD COLUMN     "previousAestheticProcedures" TEXT,
ADD COLUMN     "productAllergies" TEXT,
ADD COLUMN     "smokingStatus" TEXT,
ADD COLUMN     "surgicalHistory" TEXT;

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "assignedDoctorId" TEXT,
ADD COLUMN     "lastVisitAt" TIMESTAMP(3),
ADD COLUMN     "nextVisitAt" TIMESTAMP(3),
ADD COLUMN     "primaryConcern" TEXT,
ADD COLUMN     "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "registrationSource" TEXT,
ADD COLUMN     "status" "PatientStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "ClinicalEncounter" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "legacySessionId" TEXT,
    "branchId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "therapistId" TEXT,
    "type" "EncounterType" NOT NULL,
    "visitDate" TIMESTAMP(3) NOT NULL,
    "chiefComplaint" TEXT,
    "history" TEXT,
    "examination" TEXT,
    "assessment" TEXT,
    "diagnosis" TEXT,
    "treatmentAdvised" TEXT,
    "procedurePerformed" TEXT,
    "followUpPlan" TEXT,
    "clinicalNotes" TEXT,
    "templateKey" TEXT,
    "attachments" JSONB,
    "status" "EncounterStatus" NOT NULL DEFAULT 'DRAFT',
    "signedById" TEXT,
    "signedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicalEncounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalEncounterAddendum" (
    "id" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClinicalEncounterAddendum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "branchId" TEXT,
    "schema" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicalTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreatmentPlan" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "concern" TEXT NOT NULL,
    "diagnosis" TEXT,
    "goals" TEXT,
    "assignedDoctorId" TEXT NOT NULL,
    "assignedTherapistId" TEXT,
    "estimatedStartDate" TIMESTAMP(3),
    "estimatedEndDate" TIMESTAMP(3),
    "estimatedCost" DECIMAL(12,2),
    "status" "TreatmentPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "patientAcceptance" "PatientAcceptanceStatus" NOT NULL DEFAULT 'PENDING',
    "consentStatus" "ClinicalConsentStatus" NOT NULL DEFAULT 'PENDING',
    "reviewDate" TIMESTAMP(3),
    "outcome" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TreatmentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreatmentPlanItem" (
    "id" TEXT NOT NULL,
    "treatmentPlanId" TEXT NOT NULL,
    "serviceId" TEXT,
    "name" TEXT NOT NULL,
    "plannedSessions" INTEGER NOT NULL,
    "completedSessions" INTEGER NOT NULL DEFAULT 0,
    "frequency" TEXT,
    "practitionerId" TEXT,
    "estimatedAmount" DECIMAL(12,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TreatmentPlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcedureSession" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "encounterId" TEXT,
    "treatmentPlanId" TEXT,
    "treatmentPlanItemId" TEXT,
    "packageId" TEXT,
    "branchId" TEXT NOT NULL,
    "procedureName" TEXT NOT NULL,
    "treatmentArea" TEXT,
    "practitionerId" TEXT NOT NULL,
    "assistantId" TEXT,
    "roomId" TEXT,
    "deviceId" TEXT,
    "deviceSerialNumber" TEXT,
    "deviceParameters" JSONB,
    "consumables" JSONB,
    "batchNumbers" JSONB,
    "preProcedureChecklist" JSONB,
    "consentVerified" BOOLEAN NOT NULL DEFAULT false,
    "anaesthesia" TEXT,
    "procedureNotes" TEXT,
    "patientTolerance" TEXT,
    "immediateReaction" TEXT,
    "complication" TEXT,
    "postCareInstructions" TEXT,
    "followUpDate" TIMESTAMP(3),
    "beforeImages" JSONB,
    "afterImages" JSONB,
    "adverseEventFlag" BOOLEAN NOT NULL DEFAULT false,
    "status" "ProcedureSessionStatus" NOT NULL DEFAULT 'PLANNED',
    "performedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcedureSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Medicine" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "genericName" TEXT,
    "strength" TEXT,
    "form" TEXT,
    "status" "MedicineStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Medicine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prescription" (
    "id" TEXT NOT NULL,
    "prescriptionNo" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterId" TEXT,
    "doctorId" TEXT NOT NULL,
    "prescribedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diagnosisSummary" TEXT,
    "instructions" TEXT,
    "precautions" TEXT,
    "followUpDate" TIMESTAMP(3),
    "status" "PrescriptionStatus" NOT NULL DEFAULT 'DRAFT',
    "signedById" TEXT,
    "signedAt" TIMESTAMP(3),
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrescriptionItem" (
    "id" TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "medicineId" TEXT,
    "medicineName" TEXT NOT NULL,
    "genericName" TEXT,
    "strength" TEXT,
    "dosage" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "route" TEXT,
    "timing" TEXT,
    "instructions" TEXT,

    CONSTRAINT "PrescriptionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalEncounter_legacySessionId_key" ON "ClinicalEncounter"("legacySessionId");

-- CreateIndex
CREATE INDEX "ClinicalEncounter_patientId_visitDate_idx" ON "ClinicalEncounter"("patientId", "visitDate");

-- CreateIndex
CREATE INDEX "ClinicalEncounter_doctorId_status_visitDate_idx" ON "ClinicalEncounter"("doctorId", "status", "visitDate");

-- CreateIndex
CREATE INDEX "ClinicalEncounter_branchId_visitDate_idx" ON "ClinicalEncounter"("branchId", "visitDate");

-- CreateIndex
CREATE INDEX "ClinicalEncounter_appointmentId_idx" ON "ClinicalEncounter"("appointmentId");

-- CreateIndex
CREATE INDEX "ClinicalEncounterAddendum_encounterId_createdAt_idx" ON "ClinicalEncounterAddendum"("encounterId", "createdAt");

-- CreateIndex
CREATE INDEX "ClinicalTemplate_category_active_idx" ON "ClinicalTemplate"("category", "active");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalTemplate_key_branchId_key" ON "ClinicalTemplate"("key", "branchId");

-- CreateIndex
CREATE INDEX "TreatmentPlan_patientId_status_idx" ON "TreatmentPlan"("patientId", "status");

-- CreateIndex
CREATE INDEX "TreatmentPlan_assignedDoctorId_status_idx" ON "TreatmentPlan"("assignedDoctorId", "status");

-- CreateIndex
CREATE INDEX "TreatmentPlan_branchId_status_idx" ON "TreatmentPlan"("branchId", "status");

-- CreateIndex
CREATE INDEX "TreatmentPlanItem_treatmentPlanId_idx" ON "TreatmentPlanItem"("treatmentPlanId");

-- CreateIndex
CREATE INDEX "TreatmentPlanItem_serviceId_idx" ON "TreatmentPlanItem"("serviceId");

-- CreateIndex
CREATE INDEX "ProcedureSession_patientId_performedAt_idx" ON "ProcedureSession"("patientId", "performedAt");

-- CreateIndex
CREATE INDEX "ProcedureSession_practitionerId_status_idx" ON "ProcedureSession"("practitionerId", "status");

-- CreateIndex
CREATE INDEX "ProcedureSession_branchId_status_idx" ON "ProcedureSession"("branchId", "status");

-- CreateIndex
CREATE INDEX "ProcedureSession_treatmentPlanId_idx" ON "ProcedureSession"("treatmentPlanId");

-- CreateIndex
CREATE INDEX "Medicine_status_name_idx" ON "Medicine"("status", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Medicine_name_strength_key" ON "Medicine"("name", "strength");

-- CreateIndex
CREATE UNIQUE INDEX "Prescription_prescriptionNo_key" ON "Prescription"("prescriptionNo");

-- CreateIndex
CREATE INDEX "Prescription_patientId_prescribedAt_idx" ON "Prescription"("patientId", "prescribedAt");

-- CreateIndex
CREATE INDEX "Prescription_doctorId_status_idx" ON "Prescription"("doctorId", "status");

-- CreateIndex
CREATE INDEX "Prescription_encounterId_idx" ON "Prescription"("encounterId");

-- CreateIndex
CREATE INDEX "PrescriptionItem_prescriptionId_idx" ON "PrescriptionItem"("prescriptionId");

-- CreateIndex
CREATE INDEX "PrescriptionItem_medicineId_idx" ON "PrescriptionItem"("medicineId");

-- CreateIndex
CREATE INDEX "Patient_assignedDoctorId_status_idx" ON "Patient"("assignedDoctorId", "status");

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_assignedDoctorId_fkey" FOREIGN KEY ("assignedDoctorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalEncounter" ADD CONSTRAINT "ClinicalEncounter_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalEncounter" ADD CONSTRAINT "ClinicalEncounter_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalEncounter" ADD CONSTRAINT "ClinicalEncounter_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalEncounter" ADD CONSTRAINT "ClinicalEncounter_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalEncounter" ADD CONSTRAINT "ClinicalEncounter_therapistId_fkey" FOREIGN KEY ("therapistId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalEncounter" ADD CONSTRAINT "ClinicalEncounter_signedById_fkey" FOREIGN KEY ("signedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalEncounterAddendum" ADD CONSTRAINT "ClinicalEncounterAddendum_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "ClinicalEncounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalEncounterAddendum" ADD CONSTRAINT "ClinicalEncounterAddendum_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalTemplate" ADD CONSTRAINT "ClinicalTemplate_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentPlan" ADD CONSTRAINT "TreatmentPlan_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentPlan" ADD CONSTRAINT "TreatmentPlan_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentPlan" ADD CONSTRAINT "TreatmentPlan_assignedDoctorId_fkey" FOREIGN KEY ("assignedDoctorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentPlan" ADD CONSTRAINT "TreatmentPlan_assignedTherapistId_fkey" FOREIGN KEY ("assignedTherapistId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentPlanItem" ADD CONSTRAINT "TreatmentPlanItem_treatmentPlanId_fkey" FOREIGN KEY ("treatmentPlanId") REFERENCES "TreatmentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentPlanItem" ADD CONSTRAINT "TreatmentPlanItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ClinicService"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentPlanItem" ADD CONSTRAINT "TreatmentPlanItem_practitionerId_fkey" FOREIGN KEY ("practitionerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcedureSession" ADD CONSTRAINT "ProcedureSession_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcedureSession" ADD CONSTRAINT "ProcedureSession_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcedureSession" ADD CONSTRAINT "ProcedureSession_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "ClinicalEncounter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcedureSession" ADD CONSTRAINT "ProcedureSession_treatmentPlanId_fkey" FOREIGN KEY ("treatmentPlanId") REFERENCES "TreatmentPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcedureSession" ADD CONSTRAINT "ProcedureSession_treatmentPlanItemId_fkey" FOREIGN KEY ("treatmentPlanItemId") REFERENCES "TreatmentPlanItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcedureSession" ADD CONSTRAINT "ProcedureSession_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "TreatmentPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcedureSession" ADD CONSTRAINT "ProcedureSession_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcedureSession" ADD CONSTRAINT "ProcedureSession_practitionerId_fkey" FOREIGN KEY ("practitionerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcedureSession" ADD CONSTRAINT "ProcedureSession_assistantId_fkey" FOREIGN KEY ("assistantId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcedureSession" ADD CONSTRAINT "ProcedureSession_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ClinicResource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcedureSession" ADD CONSTRAINT "ProcedureSession_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "ClinicResource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "ClinicalEncounter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_signedById_fkey" FOREIGN KEY ("signedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescriptionItem" ADD CONSTRAINT "PrescriptionItem_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescriptionItem" ADD CONSTRAINT "PrescriptionItem_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "Medicine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Preserve and enrich legacy patient-registration context.
UPDATE "Patient" p
SET "registeredAt" = p."createdAt",
    "registrationSource" = l."source"::text,
    "primaryConcern" = (
      SELECT COALESCE(mp."skinConcern", mp."hairConcern")
      FROM "MedicalProfile" mp
      WHERE mp."patientId" = p."id"
    ),
    "lastVisitAt" = (SELECT max(s."visitDate") FROM "Session" s WHERE s."patientId" = p."id"),
    "nextVisitAt" = (
      SELECT min(a."appointmentAt")
      FROM "Appointment" a
      WHERE a."leadId" = p."leadId"
        AND a."appointmentAt" > CURRENT_TIMESTAMP
        AND a."status" NOT IN ('CANCELLED', 'NO_SHOW')
    ),
    "assignedDoctorId" = (
      SELECT a."doctorId"
      FROM "Appointment" a
      WHERE a."leadId" = p."leadId" AND a."doctorId" IS NOT NULL
      ORDER BY a."appointmentAt" DESC
      LIMIT 1
    )
FROM "Lead" l
WHERE l."id" = p."leadId";

-- Convert every historical Session into a structured, editable draft encounter.
-- The old Session table remains intact for backward-compatible APIs.
INSERT INTO "ClinicalEncounter" (
  "id", "patientId", "appointmentId", "legacySessionId", "branchId", "doctorId",
  "type", "visitDate", "chiefComplaint", "diagnosis", "treatmentAdvised",
  "procedurePerformed", "followUpPlan", "clinicalNotes", "status", "createdAt", "updatedAt"
)
SELECT
  'enc_' || md5('legacy-session:' || s."id"), s."patientId", s."appointmentId", s."id", p."branchId",
  COALESCE(a."doctorId", clinician."id"),
  (CASE s."treatmentType"::text
    WHEN 'CONSULTATION' THEN 'CONSULTATION'
    WHEN 'VIDEO_CONSULTATION' THEN 'VIDEO_CONSULTATION'
    WHEN 'FOLLOW_UP' THEN 'FOLLOW_UP_CONSULTATION'
    WHEN 'PROCEDURE' THEN 'PROCEDURE'
    WHEN 'TREATMENT_ROOM' THEN 'TREATMENT_SESSION'
    ELSE 'OTHER'
  END)::"EncounterType",
  s."visitDate", s."chiefComplaint", s."diagnosis", s."treatmentSuggested",
  s."treatmentTaken", CASE WHEN s."followupDate" IS NOT NULL THEN 'Follow up on ' || s."followupDate"::date::text END,
  s."notes", 'DRAFT', s."createdAt", s."updatedAt"
FROM "Session" s
JOIN "Patient" p ON p."id" = s."patientId"
LEFT JOIN "Appointment" a ON a."id" = s."appointmentId"
CROSS JOIN LATERAL (
  SELECT u."id"
  FROM "User" u
  WHERE u."status" = 'ACTIVE' AND u."role" IN ('DOCTOR', 'ADMIN', 'ORGANISATION_OWNER', 'CLINIC_ADMIN')
  ORDER BY CASE WHEN u."role" = 'DOCTOR' THEN 0 ELSE 1 END, u."createdAt"
  LIMIT 1
) clinician;

-- Preserve legacy structured prescription arrays as draft prescriptions and items.
INSERT INTO "Prescription" (
  "id", "prescriptionNo", "patientId", "encounterId", "doctorId", "prescribedAt",
  "diagnosisSummary", "status", "createdAt", "updatedAt"
)
SELECT
  'rx_' || md5('legacy-session:' || s."id"),
  'RX-LEGACY-' || upper(substr(md5(s."id"), 1, 8)),
  s."patientId", e."id", e."doctorId", s."visitDate", s."diagnosis", 'DRAFT', s."createdAt", s."updatedAt"
FROM "Session" s
JOIN "ClinicalEncounter" e ON e."legacySessionId" = s."id"
WHERE s."prescription" IS NOT NULL AND jsonb_typeof(s."prescription") = 'array';

INSERT INTO "PrescriptionItem" (
  "id", "prescriptionId", "medicineName", "strength", "dosage", "frequency", "duration", "instructions"
)
SELECT
  'rxi_' || md5(s."id" || ':' || item.ordinality::text),
  'rx_' || md5('legacy-session:' || s."id"),
  COALESCE(item.value->>'medicine', 'Legacy medicine'), item.value->>'strength',
  COALESCE(item.value->>'dosage', 'As directed'), COALESCE(item.value->>'frequency', 'As directed'),
  COALESCE(item.value->>'duration', 'As directed'), item.value->>'instructions'
FROM "Session" s
CROSS JOIN LATERAL jsonb_array_elements(s."prescription") WITH ORDINALITY AS item(value, ordinality)
WHERE s."prescription" IS NOT NULL AND jsonb_typeof(s."prescription") = 'array';

-- Safe global starter templates; clinics can clone or override them by branch.
INSERT INTO "ClinicalTemplate" ("id", "name", "key", "category", "schema", "createdAt", "updatedAt") VALUES
  ('clinical_template_soap', 'SOAP Note', 'soap-note', 'ENCOUNTER', '{"sections":["subjective","objective","assessment","plan"]}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('clinical_template_dermatology', 'Dermatology Consultation', 'dermatology-consultation', 'ENCOUNTER', '{"sections":["chiefComplaint","history","skinExamination","assessment","diagnosis","plan"]}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('clinical_template_hair', 'Hair-loss Consultation', 'hair-loss-consultation', 'ENCOUNTER', '{"sections":["history","scalpExamination","hairPullTest","diagnosis","plan"]}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('clinical_template_laser', 'Laser Procedure', 'laser-procedure', 'PROCEDURE', '{"parameters":["device","handpiece","mode","spotSize","energy","fluence","pulseWidth","frequency","passes","coolingMethod","testPatchResult"]}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('clinical_template_aesthetic', 'Aesthetic Consultation', 'aesthetic-consultation', 'ENCOUNTER', '{"sections":["concern","assessment","goals","options","plan"]}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

INSERT INTO "Medicine" ("id", "name", "genericName", "strength", "form", "createdAt", "updatedAt") VALUES
  ('medicine_cetirizine_10', 'Cetirizine', 'Cetirizine', '10 mg', 'Tablet', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('medicine_doxycycline_100', 'Doxycycline', 'Doxycycline', '100 mg', 'Capsule', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('medicine_tretinoin_0025', 'Tretinoin', 'Tretinoin', '0.025%', 'Cream', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;
