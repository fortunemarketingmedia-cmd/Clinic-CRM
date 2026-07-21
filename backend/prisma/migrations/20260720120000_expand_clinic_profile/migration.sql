ALTER TABLE "ClinicSettings"
ADD COLUMN "legalName" TEXT,
ADD COLUMN "website" TEXT,
ADD COLUMN "registrationNumber" TEXT,
ADD COLUMN "city" TEXT,
ADD COLUMN "state" TEXT,
ADD COLUMN "postalCode" TEXT,
ADD COLUMN "openingHours" TEXT,
ADD COLUMN "timezone" TEXT DEFAULT 'Asia/Kolkata';
