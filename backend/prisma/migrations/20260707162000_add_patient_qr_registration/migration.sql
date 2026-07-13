ALTER TABLE "Patient" ADD COLUMN "qrToken" TEXT;

UPDATE "Patient"
SET "qrToken" = md5(random()::text || clock_timestamp()::text || id)
WHERE "qrToken" IS NULL;

ALTER TABLE "Patient" ALTER COLUMN "qrToken" SET NOT NULL;

CREATE UNIQUE INDEX "Patient_qrToken_key" ON "Patient"("qrToken");
