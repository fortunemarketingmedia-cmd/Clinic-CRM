-- Patients created directly through registration are clinical records, not sales leads.
-- Existing converted leads remain linked; only new direct registrations may have no lead.
ALTER TABLE "Patient" ALTER COLUMN "leadId" DROP NOT NULL;
