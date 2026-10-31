-- Digital sitting record chart: sitting number and areas marked on the face/body diagram for each procedure session.
ALTER TABLE "ProcedureSession"
  ADD COLUMN "sittingNumber" INTEGER,
  ADD COLUMN "chartType" TEXT,
  ADD COLUMN "chartMarkings" JSONB;
