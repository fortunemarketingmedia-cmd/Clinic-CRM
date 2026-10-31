-- 20261031072919_revive_db was generated from schema drift and dropped the trigram search indexes created by
-- 20260904010000_upload_and_patient_scaling (Prisma cannot represent them in schema.prisma). Restore them.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS "Patient_fullName_trgm_idx" ON "Patient" USING GIN ("fullName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Patient_mobile_trgm_idx" ON "Patient" USING GIN ("mobile" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Patient_email_trgm_idx" ON "Patient" USING GIN ("email" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Lead_name_trgm_idx" ON "Lead" USING GIN ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Lead_mobile_trgm_idx" ON "Lead" USING GIN ("mobile" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Lead_email_trgm_idx" ON "Lead" USING GIN ("email" gin_trgm_ops);
