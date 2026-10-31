-- Preserve the selected treatment and both signatures on the immutable consent record.
ALTER TABLE "ConsentRecord"
  ADD COLUMN "treatmentName" TEXT,
  ADD COLUMN "doctorName" TEXT,
  ADD COLUMN "doctorSignatureStorageKey" TEXT;

