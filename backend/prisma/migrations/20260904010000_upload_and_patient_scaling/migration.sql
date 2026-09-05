ALTER TYPE "DurableJobType" ADD VALUE 'FILE_OPTIMIZATION';

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

ALTER TABLE "PatientFile"
  ADD COLUMN "variant" TEXT NOT NULL DEFAULT 'ORIGINAL',
  ADD COLUMN "width" INTEGER,
  ADD COLUMN "height" INTEGER,
  ADD COLUMN "optimizationStatus" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
  ADD COLUMN "uploadIdempotencyKey" TEXT;

CREATE UNIQUE INDEX "PatientFile_uploadIdempotencyKey_key" ON "PatientFile"("uploadIdempotencyKey");
CREATE UNIQUE INDEX "PatientFile_originalFileId_variant_key" ON "PatientFile"("originalFileId", "variant");

CREATE SEQUENCE "PatientNumberSeq";
SELECT setval(
  '"PatientNumberSeq"',
  GREATEST(
    COALESCE((SELECT MAX(NULLIF(regexp_replace("patientNo", '\\D', '', 'g'), '')::BIGINT) FROM "Patient"), 0),
    1
  ),
  EXISTS (SELECT 1 FROM "Patient")
);

CREATE INDEX "Patient_fullName_trgm_idx" ON "Patient" USING GIN ("fullName" gin_trgm_ops);
CREATE INDEX "Patient_mobile_trgm_idx" ON "Patient" USING GIN ("mobile" gin_trgm_ops);
CREATE INDEX "Patient_email_trgm_idx" ON "Patient" USING GIN ("email" gin_trgm_ops);
CREATE INDEX "Lead_name_trgm_idx" ON "Lead" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "Lead_mobile_trgm_idx" ON "Lead" USING GIN ("mobile" gin_trgm_ops);
CREATE INDEX "Lead_email_trgm_idx" ON "Lead" USING GIN ("email" gin_trgm_ops);
