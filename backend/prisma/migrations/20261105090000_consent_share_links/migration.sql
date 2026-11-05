-- Secure, expiring invitations let a patient review and sign a treatment consent
-- without exposing patient or template identifiers in the public URL.
CREATE TABLE "ConsentInvitation" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateVersionId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "treatmentName" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "consentRecordId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConsentInvitation_tokenHash_key" ON "ConsentInvitation"("tokenHash");
CREATE UNIQUE INDEX "ConsentInvitation_consentRecordId_key" ON "ConsentInvitation"("consentRecordId");
CREATE INDEX "ConsentInvitation_patientId_createdAt_idx" ON "ConsentInvitation"("patientId", "createdAt");
CREATE INDEX "ConsentInvitation_expiresAt_idx" ON "ConsentInvitation"("expiresAt");
