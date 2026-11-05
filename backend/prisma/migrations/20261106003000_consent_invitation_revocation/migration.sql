ALTER TABLE "ConsentInvitation"
ADD COLUMN "revokedAt" TIMESTAMP(3),
ADD COLUMN "revokedById" TEXT,
ADD COLUMN "revocationReason" TEXT;

CREATE INDEX "ConsentInvitation_patientId_templateId_revokedAt_usedAt_idx"
ON "ConsentInvitation"("patientId", "templateId", "revokedAt", "usedAt");
