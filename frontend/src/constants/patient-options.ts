export const SEX_OPTIONS = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
] as const;

export const MARITAL_STATUS_OPTIONS = [
  'Single',
  'Married',
  'Separated',
  'Divorced',
  'Widowed',
  'Prefer not to say',
] as const;

export const SCAR_HISTORY_OPTIONS = [
  'No known history',
  'Yes',
  'Unsure',
] as const;

export const MENSTRUAL_HISTORY_OPTIONS = [
  'Not applicable',
  'Regular',
  'Irregular',
  'Post-menopausal',
  'Prefer not to say',
] as const;

export const PREGNANCY_STATUS_OPTIONS = [
  'Not applicable',
  'Not pregnant',
  'Pregnant',
  'Breastfeeding',
  'Planning pregnancy',
  'Unsure',
  'Prefer not to say',
] as const;
