-- Client numbers are now "<year>-<serial>" (for example 2026-0001) with the serial restarting every year.
-- Existing REV-P-xxxxx numbers are left untouched.
CREATE TABLE "PatientNumberCounter" (
    "year" INTEGER NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PatientNumberCounter_pkey" PRIMARY KEY ("year")
);
