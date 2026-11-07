-- HIFU "Face & Neck Patient Record": KJ written in each chart box, keyed by box id.
ALTER TABLE "ProcedureSession"
  ADD COLUMN "chartValues" JSONB;
