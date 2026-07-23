export function normalizeMobile(value: string) {
  const digits = value.replace(/\D/g, '');

  // Clinic contact numbers are Indian mobile numbers. Keeping the final ten
  // digits makes local, +91 and 0-prefixed representations resolve identically.
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export function normalizeEmail(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  return normalized || undefined;
}
