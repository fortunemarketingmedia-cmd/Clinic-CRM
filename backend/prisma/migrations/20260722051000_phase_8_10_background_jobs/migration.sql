-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DurableJobType" ADD VALUE 'INTEGRATION_EVENT_PROCESS';
ALTER TYPE "DurableJobType" ADD VALUE 'INTEGRATION_SYNC';
ALTER TYPE "DurableJobType" ADD VALUE 'CONVERSION_UPLOAD';
ALTER TYPE "DurableJobType" ADD VALUE 'AUTOMATION_EXECUTION';
