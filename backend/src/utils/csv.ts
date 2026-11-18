/** Quote CSV fields and prevent untrusted text from being evaluated as a spreadsheet formula. */
export function csvCell(value: string | number) {
  const text = String(value);
  let first = 0;
  while (first < text.length && (text.charCodeAt(first) <= 32 || /\s/u.test(text[first]))) first += 1;
  const safe = typeof value === 'string' && /^[=+@-]/u.test(text.slice(first)) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
