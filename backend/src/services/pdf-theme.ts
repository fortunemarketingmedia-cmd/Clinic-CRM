/** Shared look for invoices, receipts and finance reports so every downloadable document reads as one family. */
export const pdfColors = { brand: '#176B78', ink: '#253640', muted: '#5F6F7B', soft: '#6B7B86', rule: '#D5E2E4', band: '#F1F8F7' } as const;

/** Branch phone numbers seeded as all zeros are placeholders; never print them on a legal document. */
export function cleanPhone(value?: string | null) {
  const digits = (value ?? '').replace(/\D/g, '');
  if (digits.length < 6 || /^0+$/.test(digits)) return '';
  return (value ?? '').trim();
}
