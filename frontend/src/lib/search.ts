function valueScore(search: string, value: string | null | undefined, fieldPenalty: number) {
  const normalized = value?.trim().toLocaleLowerCase();
  if (!normalized) return Number.POSITIVE_INFINITY;
  if (normalized === search) return fieldPenalty;
  if (normalized.startsWith(search)) return fieldPenalty + 1;
  if (normalized.split(/[^\p{L}\p{N}]+/u).some((word) => word.startsWith(search))) return fieldPenalty + 2;
  if (search.length >= 3 && normalized.includes(search)) return fieldPenalty + 3;
  return Number.POSITIVE_INFINITY;
}

export function filterAndRankSearch<T>(items: T[], searchValue: string, values: (item: T) => Array<string | null | undefined>, secondaryValues: (item: T) => Array<string | null | undefined> = () => []) {
  const search = searchValue.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  if (!search) return items;

  return items
    .map((item, index) => ({
      item,
      index,
      score: Math.min(
        ...values(item).map((value) => valueScore(search, value, 0)),
        ...secondaryValues(item).map((value) => valueScore(search, value, 10)),
      ),
    }))
    .filter(({ score }) => Number.isFinite(score))
    .sort((left, right) => left.score - right.score || left.index - right.index)
    .map(({ item }) => item);
}

