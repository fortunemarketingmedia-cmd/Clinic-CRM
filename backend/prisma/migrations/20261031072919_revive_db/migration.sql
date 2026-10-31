-- DropForeignKey
ALTER TABLE "Patient" DROP CONSTRAINT "Patient_leadId_fkey";

-- DropIndex
DROP INDEX "Lead_email_trgm_idx";

-- DropIndex
DROP INDEX "Lead_mobile_trgm_idx";

-- DropIndex
DROP INDEX "Lead_name_trgm_idx";

-- DropIndex
DROP INDEX "Patient_email_trgm_idx";

-- DropIndex
DROP INDEX "Patient_fullName_trgm_idx";

-- DropIndex
DROP INDEX "Patient_mobile_trgm_idx";

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
