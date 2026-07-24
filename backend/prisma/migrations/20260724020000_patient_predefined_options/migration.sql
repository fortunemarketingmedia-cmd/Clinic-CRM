UPDATE "FormField"
SET
  "type" = 'DROPDOWN',
  "options" = '["Single","Married","Separated","Divorced","Widowed","Prefer not to say"]'::jsonb,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'field_registration_marital';

UPDATE "FormField"
SET
  "type" = 'DROPDOWN',
  "options" = '["No known history","Yes","Unsure"]'::jsonb,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'field_registration_scar';

UPDATE "FormField"
SET
  "type" = 'DROPDOWN',
  "options" = '["Not applicable","Regular","Irregular","Post-menopausal","Prefer not to say"]'::jsonb,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'field_registration_menstrual';

UPDATE "FormField"
SET
  "type" = 'DROPDOWN',
  "options" = '["Not applicable","Not pregnant","Pregnant","Breastfeeding","Planning pregnancy","Unsure","Prefer not to say"]'::jsonb,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'field_registration_pregnancy';
