-- Give each digital sitting record its own descriptive name.
ALTER TABLE "ProcedureSession"
  ADD COLUMN "sittingName" TEXT;
