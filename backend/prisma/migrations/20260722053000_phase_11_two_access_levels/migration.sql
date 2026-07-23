CREATE TYPE "AccessLevel" AS ENUM ('ADMIN', 'RECEPTIONIST');
ALTER TABLE "User" ADD COLUMN "accessLevel" "AccessLevel" NOT NULL DEFAULT 'RECEPTIONIST';
UPDATE "User" SET "accessLevel" = 'ADMIN' WHERE "role" = 'ADMIN';
CREATE INDEX "User_accessLevel_status_idx" ON "User"("accessLevel", "status");
