type InsensitiveStringFilter = {
  startsWith?: string;
  contains?: string;
  mode: 'insensitive';
};

export function normalizeSearchTerm(value?: string) {
  return value?.trim().replace(/\s+/g, ' ') ?? '';
}

/**
 * One- and two-character searches stay prefix-oriented so broad metadata
 * matches do not drown out the records the user is trying to find. Once the
 * term is specific enough, substring matching is also useful for typos and
 * partial words.
 */
export function textSearchVariants(value?: string): InsensitiveStringFilter[] {
  const search = normalizeSearchTerm(value);
  if (!search) return [];

  return [
    { startsWith: search, mode: 'insensitive' },
    { contains: ` ${search}`, mode: 'insensitive' },
    ...(search.length >= 3 ? [{ contains: search, mode: 'insensitive' as const }] : []),
  ];
}

export function rankSearchResult(searchValue: string, primaryValues: Array<string | null | undefined>, secondaryValues: Array<string | null | undefined> = []) {
  const search = normalizeSearchTerm(searchValue).toLocaleLowerCase();
  if (!search) return 0;

  const score = (value: string | null | undefined, fieldPenalty: number) => {
    const normalized = value?.trim().toLocaleLowerCase();
    if (!normalized) return Number.POSITIVE_INFINITY;
    if (normalized === search) return fieldPenalty;
    if (normalized.startsWith(search)) return fieldPenalty + 1;
    if (normalized.split(/[^\p{L}\p{N}]+/u).some((word) => word.startsWith(search))) return fieldPenalty + 2;
    if (search.length >= 3 && normalized.includes(search)) return fieldPenalty + 3;
    return Number.POSITIVE_INFINITY;
  };

  return Math.min(
    ...primaryValues.map((value) => score(value, 0)),
    ...secondaryValues.map((value) => score(value, 10)),
  );
}

