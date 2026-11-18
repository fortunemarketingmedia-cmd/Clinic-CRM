/** Remove aggregate financial reporting from receptionist JSON responses.
 * Patient invoices, payments, package prices and balances are operational records.
 */
const aggregateKeys = new Set(['financial', 'revenue', 'todayRevenue', 'monthlyRevenue', 'billed', 'collected']);

export function redactFinancials<T>(value: T, parentKey?: string): T {
  if (Array.isArray(value)) return value.map((item) => redactFinancials(item, parentKey)) as T;
  if (value && typeof value === 'object' && !(value instanceof Date) && typeof (value as { toJSON?: unknown }).toJSON !== 'function') {
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (aggregateKeys.has(key) || (key === 'invoices' && parentKey === '_count')) continue;
      output[key] = redactFinancials(child, key);
    }
    return output as T;
  }
  return value;
}
