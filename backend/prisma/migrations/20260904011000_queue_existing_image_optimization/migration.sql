UPDATE "PatientFile"
SET "optimizationStatus" = 'QUEUED'
WHERE "originalFileId" IS NULL
  AND "storageKey" IS NOT NULL
  AND "mimeType" IN ('image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif');

INSERT INTO "DurableJob" (
  "id", "type", "status", "idempotencyKey", "payload", "runAt", "attempts", "maxAttempts", "createdAt", "updatedAt"
)
SELECT
  'file-opt-' || "id",
  'FILE_OPTIMIZATION'::"DurableJobType",
  'QUEUED'::"DurableJobStatus",
  'file-optimize:' || "id",
  jsonb_build_object('fileId', "id"),
  NOW(), 0, 5, NOW(), NOW()
FROM "PatientFile"
WHERE "originalFileId" IS NULL
  AND "storageKey" IS NOT NULL
  AND "mimeType" IN ('image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif')
ON CONFLICT ("idempotencyKey") DO NOTHING;
