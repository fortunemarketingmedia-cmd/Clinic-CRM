-- CreateEnum
CREATE TYPE "FormType" AS ENUM ('PATIENT_REGISTRATION', 'MEDICAL_INTAKE', 'GENERAL_TREATMENT_CONSENT', 'PROCEDURE_SPECIFIC_CONSENT', 'PHOTOGRAPHY_CONSENT', 'MARKETING_USE_CONSENT', 'DATA_PROCESSING_CONSENT', 'TELECONSULTATION_CONSENT', 'MINOR_GUARDIAN_CONSENT', 'PACKAGE_AGREEMENT', 'FINANCIAL_AGREEMENT', 'AFTERCARE_ACKNOWLEDGEMENT', 'FEEDBACK');

-- CreateEnum
CREATE TYPE "FormFieldType" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'DROPDOWN', 'MULTI_SELECT', 'CHECKBOX', 'RADIO', 'SIGNATURE', 'FILE_UPLOAD', 'IMAGE_UPLOAD', 'DECLARATION');

-- CreateEnum
CREATE TYPE "TemplateStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "FormSubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'REVIEWED', 'VOIDED');

-- CreateEnum
CREATE TYPE "ConsentRecordStatus" AS ENUM ('PENDING', 'SIGNED', 'WITHDRAWN', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PatientFileType" AS ENUM ('CLINICAL_PHOTOGRAPH', 'BEFORE_IMAGE', 'AFTER_IMAGE', 'MEDICAL_REPORT', 'PRESCRIPTION', 'CONSENT', 'INVOICE', 'PAYMENT_RECEIPT', 'IDENTITY_DOCUMENT', 'OTHER_DOCUMENT');

-- CreateEnum
CREATE TYPE "FileVisibility" AS ENUM ('CLINICAL_ONLY', 'CARE_TEAM', 'ADMINISTRATIVE', 'PATIENT_VISIBLE');

-- CreateEnum
CREATE TYPE "PhotoAngle" AS ENUM ('FRONT', 'LEFT', 'RIGHT', 'CLOSE_UP', 'TREATMENT_AREA', 'OTHER');

-- AlterTable
ALTER TABLE "PatientFile" ADD COLUMN     "annotation" JSONB,
ADD COLUMN     "appointmentId" TEXT,
ADD COLUMN     "checksum" TEXT,
ADD COLUMN     "clinicalUsePermission" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "encounterId" TEXT,
ADD COLUMN     "fileType" "PatientFileType" NOT NULL DEFAULT 'OTHER_DOCUMENT',
ADD COLUMN     "marketingPermission" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "originalFileId" TEXT,
ADD COLUMN     "originalFilename" TEXT,
ADD COLUMN     "photoAngle" "PhotoAngle",
ADD COLUMN     "procedureSessionId" TEXT,
ADD COLUMN     "storageKey" TEXT,
ADD COLUMN     "treatmentArea" TEXT,
ADD COLUMN     "uploadedById" TEXT,
ADD COLUMN     "visibility" "FileVisibility" NOT NULL DEFAULT 'CARE_TEAM',
ADD COLUMN     "visitDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "FormTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FormType" NOT NULL,
    "description" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "branchId" TEXT,
    "status" "TemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormField" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "FormFieldType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "readOnly" BOOLEAN NOT NULL DEFAULT false,
    "placeholder" TEXT,
    "helpText" TEXT,
    "options" JSONB,
    "condition" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormTemplateVersion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormTemplateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormSubmission" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateVersionId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "procedureSessionId" TEXT,
    "submittedById" TEXT,
    "values" JSONB NOT NULL,
    "status" "FormSubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "ipAddress" TEXT,
    "deviceMetadata" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FormType" NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "branchId" TEXT,
    "status" "TemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "consentText" TEXT NOT NULL,
    "requiresGuardian" BOOLEAN NOT NULL DEFAULT false,
    "requiresWitness" BOOLEAN NOT NULL DEFAULT false,
    "expiryDays" INTEGER,
    "createdById" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentTemplateVersion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "consentText" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentTemplateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateVersionId" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "patientId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "procedureSessionId" TEXT,
    "language" TEXT NOT NULL,
    "consentText" TEXT NOT NULL,
    "signerName" TEXT NOT NULL,
    "signatureStorageKey" TEXT NOT NULL,
    "guardianName" TEXT,
    "guardianRelationship" TEXT,
    "guardianSignatureStorageKey" TEXT,
    "staffWitnessId" TEXT,
    "signedPdfStorageKey" TEXT NOT NULL,
    "status" "ConsentRecordStatus" NOT NULL DEFAULT 'SIGNED',
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "deviceMetadata" TEXT,
    "expiresAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "withdrawalReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FormTemplate_type_status_idx" ON "FormTemplate"("type", "status");

-- CreateIndex
CREATE INDEX "FormTemplate_branchId_status_idx" ON "FormTemplate"("branchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FormTemplate_key_branchId_key" ON "FormTemplate"("key", "branchId");

-- CreateIndex
CREATE INDEX "FormField_templateId_sortOrder_idx" ON "FormField"("templateId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "FormField_templateId_key_key" ON "FormField"("templateId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "FormTemplateVersion_templateId_version_key" ON "FormTemplateVersion"("templateId", "version");

-- CreateIndex
CREATE INDEX "FormSubmission_patientId_submittedAt_idx" ON "FormSubmission"("patientId", "submittedAt");

-- CreateIndex
CREATE INDEX "FormSubmission_templateId_status_idx" ON "FormSubmission"("templateId", "status");

-- CreateIndex
CREATE INDEX "FormSubmission_appointmentId_idx" ON "FormSubmission"("appointmentId");

-- CreateIndex
CREATE INDEX "ConsentTemplate_type_status_idx" ON "ConsentTemplate"("type", "status");

-- CreateIndex
CREATE INDEX "ConsentTemplate_branchId_status_idx" ON "ConsentTemplate"("branchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentTemplate_key_branchId_key" ON "ConsentTemplate"("key", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentTemplateVersion_templateId_version_key" ON "ConsentTemplateVersion"("templateId", "version");

-- CreateIndex
CREATE INDEX "ConsentRecord_patientId_signedAt_idx" ON "ConsentRecord"("patientId", "signedAt");

-- CreateIndex
CREATE INDEX "ConsentRecord_templateId_status_idx" ON "ConsentRecord"("templateId", "status");

-- CreateIndex
CREATE INDEX "ConsentRecord_appointmentId_idx" ON "ConsentRecord"("appointmentId");

-- CreateIndex
CREATE INDEX "ConsentRecord_procedureSessionId_idx" ON "ConsentRecord"("procedureSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "PatientFile_storageKey_key" ON "PatientFile"("storageKey");

-- CreateIndex
CREATE INDEX "PatientFile_encounterId_idx" ON "PatientFile"("encounterId");

-- CreateIndex
CREATE INDEX "PatientFile_procedureSessionId_idx" ON "PatientFile"("procedureSessionId");

-- CreateIndex
CREATE INDEX "PatientFile_appointmentId_idx" ON "PatientFile"("appointmentId");

-- CreateIndex
CREATE INDEX "PatientFile_patientId_fileType_createdAt_idx" ON "PatientFile"("patientId", "fileType", "createdAt");

-- CreateIndex
CREATE INDEX "PatientFile_originalFileId_idx" ON "PatientFile"("originalFileId");

-- AddForeignKey
ALTER TABLE "FormTemplate" ADD CONSTRAINT "FormTemplate_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormTemplate" ADD CONSTRAINT "FormTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormField" ADD CONSTRAINT "FormField_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "FormTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormTemplateVersion" ADD CONSTRAINT "FormTemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "FormTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "FormTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "FormTemplateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_procedureSessionId_fkey" FOREIGN KEY ("procedureSessionId") REFERENCES "ProcedureSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentTemplate" ADD CONSTRAINT "ConsentTemplate_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentTemplate" ADD CONSTRAINT "ConsentTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentTemplateVersion" ADD CONSTRAINT "ConsentTemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ConsentTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ConsentTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "ConsentTemplateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_procedureSessionId_fkey" FOREIGN KEY ("procedureSessionId") REFERENCES "ProcedureSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_staffWitnessId_fkey" FOREIGN KEY ("staffWitnessId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientFile" ADD CONSTRAINT "PatientFile_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "ClinicalEncounter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientFile" ADD CONSTRAINT "PatientFile_procedureSessionId_fkey" FOREIGN KEY ("procedureSessionId") REFERENCES "ProcedureSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientFile" ADD CONSTRAINT "PatientFile_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientFile" ADD CONSTRAINT "PatientFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientFile" ADD CONSTRAINT "PatientFile_originalFileId_fkey" FOREIGN KEY ("originalFileId") REFERENCES "PatientFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Preserve legacy file references without exposing them as permanent browser URLs.
UPDATE "PatientFile"
SET "originalFilename" = COALESCE("originalFilename", "name"),
    "storageKey" = COALESCE("storageKey", 'legacy/' || "id"),
    "fileType" = (CASE "category"::text
      WHEN 'IMAGE' THEN 'CLINICAL_PHOTOGRAPH'
      WHEN 'PRESCRIPTION' THEN 'PRESCRIPTION'
      WHEN 'REPORT' THEN 'MEDICAL_REPORT'
      WHEN 'INVOICE' THEN 'INVOICE'
      ELSE 'OTHER_DOCUMENT'
    END)::"PatientFileType",
    "visibility" = CASE WHEN "category" = 'INVOICE' THEN 'ADMINISTRATIVE'::"FileVisibility" ELSE 'CARE_TEAM'::"FileVisibility" END,
    "clinicalUsePermission" = CASE WHEN "category" = 'INVOICE' THEN false ELSE true END,
    "marketingPermission" = false,
    "visitDate" = COALESCE("visitDate", "createdAt");

-- Seed a versioned registration form from the pre-existing QR intake fields.
WITH creator AS (
  SELECT "id" FROM "User" WHERE "status" = 'ACTIVE'
  ORDER BY CASE WHEN "role" IN ('ADMIN', 'ORGANISATION_OWNER', 'CLINIC_ADMIN') THEN 0 ELSE 1 END, "createdAt" LIMIT 1
)
INSERT INTO "FormTemplate" ("id", "key", "name", "type", "description", "status", "currentVersion", "createdById", "publishedAt", "createdAt", "updatedAt")
SELECT 'form_patient_registration', 'patient-registration', 'Patient Registration & Medical Intake', 'PATIENT_REGISTRATION', 'Versioned replacement for the existing QR intake form.', 'PUBLISHED', 1, creator."id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM creator
ON CONFLICT DO NOTHING;

INSERT INTO "FormField" ("id", "templateId", "key", "label", "type", "required", "sortOrder", "createdAt", "updatedAt")
SELECT seed.id, seed.template_id, seed.key, seed.label, seed.type::"FormFieldType", seed.required, seed.sort_order, seed.created_at, seed.updated_at
FROM (VALUES
  ('field_registration_name', 'form_patient_registration', 'fullName', 'Full name', 'TEXT', true, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('field_registration_mobile', 'form_patient_registration', 'mobile', 'Mobile number', 'TEXT', true, 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('field_registration_email', 'form_patient_registration', 'email', 'Email', 'TEXT', false, 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('field_registration_age', 'form_patient_registration', 'age', 'Age', 'NUMBER', false, 40, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('field_registration_dob', 'form_patient_registration', 'dateOfBirth', 'Date of birth', 'DATE', false, 50, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('field_registration_sex', 'form_patient_registration', 'sex', 'Sex', 'DROPDOWN', false, 60, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('field_registration_address', 'form_patient_registration', 'address', 'Address', 'TEXT', false, 70, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('field_registration_marital', 'form_patient_registration', 'maritalStatus', 'Marital status', 'TEXT', false, 80, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('field_registration_occupation', 'form_patient_registration', 'occupation', 'Occupation', 'TEXT', false, 90, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('field_registration_referred', 'form_patient_registration', 'referredBy', 'Referred by', 'TEXT', false, 100, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('field_registration_skin', 'form_patient_registration', 'skinConcern', 'Skin concern', 'TEXT', false, 110, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('field_registration_hair', 'form_patient_registration', 'hairConcern', 'Hair concern', 'TEXT', false, 120, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('field_registration_medical', 'form_patient_registration', 'medicalHistory', 'Medical history', 'TEXT', false, 130, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('field_registration_medications', 'form_patient_registration', 'currentMedications', 'Current medications', 'TEXT', false, 140, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('field_registration_allergy', 'form_patient_registration', 'allergyToDrugs', 'Drug allergies', 'TEXT', false, 150, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('field_registration_scar', 'form_patient_registration', 'keloidOrHypertrophicScar', 'Keloid or hypertrophic scar history', 'TEXT', false, 160, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('field_registration_products', 'form_patient_registration', 'productsCurrentlyUsed', 'Products currently used', 'TEXT', false, 170, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('field_registration_menstrual', 'form_patient_registration', 'menstrualHistory', 'Menstrual history', 'TEXT', false, 180, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('field_registration_pregnancy', 'form_patient_registration', 'pregnancyStatus', 'Pregnancy status', 'TEXT', false, 190, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('field_registration_notes', 'form_patient_registration', 'notes', 'Other notes', 'TEXT', false, 200, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('field_registration_declaration', 'form_patient_registration', 'declaration', 'I confirm this information is accurate.', 'DECLARATION', true, 210, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
) AS seed(id, template_id, key, label, type, required, sort_order, created_at, updated_at)
JOIN "FormTemplate" ft ON ft."id" = seed.template_id
ON CONFLICT DO NOTHING;

UPDATE "FormField" SET "options" = '["MALE","FEMALE","OTHER"]'::jsonb WHERE "id" = 'field_registration_sex';

INSERT INTO "FormTemplateVersion" ("id", "templateId", "version", "snapshot", "createdAt")
SELECT 'form_version_patient_registration_1', 'form_patient_registration', 1,
  jsonb_build_object('name', ft."name", 'type', ft."type", 'language', ft."language", 'fields', COALESCE(jsonb_agg(jsonb_build_object('key', f."key", 'label', f."label", 'type', f."type", 'required', f."required", 'hidden', f."hidden", 'readOnly', f."readOnly", 'sortOrder', f."sortOrder") ORDER BY f."sortOrder"), '[]'::jsonb)), CURRENT_TIMESTAMP
FROM "FormTemplate" ft LEFT JOIN "FormField" f ON f."templateId" = ft."id" WHERE ft."id" = 'form_patient_registration' GROUP BY ft."id"
ON CONFLICT DO NOTHING;

WITH creator AS (
  SELECT "id" FROM "User" WHERE "status" = 'ACTIVE'
  ORDER BY CASE WHEN "role" IN ('ADMIN', 'ORGANISATION_OWNER', 'CLINIC_ADMIN') THEN 0 ELSE 1 END, "createdAt" LIMIT 1
)
INSERT INTO "ConsentTemplate" ("id", "key", "name", "type", "status", "currentVersion", "consentText", "requiresGuardian", "requiresWitness", "createdById", "publishedAt", "createdAt", "updatedAt")
SELECT seed.id, seed.key, seed.name, seed.type::"FormType", 'PUBLISHED', 1, seed.text, seed.guardian, seed.witness, creator."id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM creator CROSS JOIN (VALUES
  ('consent_general_treatment', 'general-treatment-consent', 'General Treatment Consent', 'GENERAL_TREATMENT_CONSENT', 'I voluntarily consent to the proposed consultation or treatment. The nature, expected benefits, material risks, alternatives, and opportunity to ask questions have been explained to me.', false, true),
  ('consent_photography', 'clinical-photography-consent', 'Clinical Photography Consent', 'PHOTOGRAPHY_CONSENT', 'I consent to clinical photographs being captured and stored securely for clinical documentation. Marketing use requires a separate explicit permission.', false, false),
  ('consent_marketing', 'marketing-use-consent', 'Marketing Use Consent', 'MARKETING_USE_CONSENT', 'I explicitly permit selected, approved photographs or testimonials to be used for clinic marketing. I understand that I may withdraw this permission for future use.', false, false)
) AS seed(id, key, name, type, text, guardian, witness)
ON CONFLICT DO NOTHING;

INSERT INTO "ConsentTemplateVersion" ("id", "templateId", "version", "consentText", "snapshot", "createdAt")
SELECT 'consent_version_' || ct."key" || '_1', ct."id", 1, ct."consentText",
  jsonb_build_object('name', ct."name", 'type', ct."type", 'language', ct."language", 'consentText', ct."consentText", 'requiresGuardian', ct."requiresGuardian", 'requiresWitness', ct."requiresWitness", 'expiryDays', ct."expiryDays"), CURRENT_TIMESTAMP
FROM "ConsentTemplate" ct WHERE ct."id" IN ('consent_general_treatment', 'consent_photography', 'consent_marketing')
ON CONFLICT DO NOTHING;
