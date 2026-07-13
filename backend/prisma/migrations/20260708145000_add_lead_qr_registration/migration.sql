ALTER TABLE "Lead" ADD COLUMN "qrToken" TEXT;

UPDATE "Lead"
SET "qrToken" = md5(random()::text || clock_timestamp()::text || id)
WHERE "qrToken" IS NULL;

ALTER TABLE "Lead" ALTER COLUMN "qrToken" SET NOT NULL;

CREATE UNIQUE INDEX "Lead_qrToken_key" ON "Lead"("qrToken");
