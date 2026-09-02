ALTER TABLE "Lead" ADD COLUMN "closedAt" TIMESTAMP(3);

UPDATE "Lead"
SET "closedAt" = COALESCE("convertedAt", "updatedAt")
WHERE "status" IN (
  'APPOINTMENT_BOOKED',
  'BOOKED',
  'CONFIRMED',
  'CONVERTED',
  'LOST',
  'DISQUALIFIED'
);

CREATE OR REPLACE FUNCTION set_lead_closed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."status" IN (
    'APPOINTMENT_BOOKED',
    'BOOKED',
    'CONFIRMED',
    'CONVERTED',
    'LOST',
    'DISQUALIFIED'
  ) THEN
    IF TG_OP = 'INSERT' OR OLD."status" NOT IN (
      'APPOINTMENT_BOOKED',
      'BOOKED',
      'CONFIRMED',
      'CONVERTED',
      'LOST',
      'DISQUALIFIED'
    ) THEN
      NEW."closedAt" = COALESCE(NEW."closedAt", CURRENT_TIMESTAMP);
    END IF;
  ELSIF TG_OP = 'UPDATE' AND OLD."status" IN (
    'APPOINTMENT_BOOKED',
    'BOOKED',
    'CONFIRMED',
    'CONVERTED',
    'LOST',
    'DISQUALIFIED'
  ) THEN
    NEW."closedAt" = NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lead_closed_at_trigger
BEFORE INSERT OR UPDATE OF "status" ON "Lead"
FOR EACH ROW
EXECUTE FUNCTION set_lead_closed_at();
