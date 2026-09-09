export const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// Resolution lives next to the data so any client (CLI, board, integrations) can
// address tickets/statuses/tags by human name or shorthand. We match an exact id
// first, then a case-insensitive name, and fail loudly on unknown or ambiguous
// values rather than picking arbitrarily (Decision 3).
export const resolveByIdOrName = <TItem extends { id: string }>(
  items: TItem[],
  value: string,
  nameOf: (item: TItem) => string,
  label: string,
) => {
  const byId = items.find((item) => item.id === value);
  if (byId) return byId.id;

  const byName = items.filter((item) => sameName(nameOf(item), value));
  if (byName.length > 1) throw new Error(`Ambiguous ${label} "${value}"`);

  const [match] = byName;
  if (match) return match.id;
  throw new Error(`Unknown ${label} "${value}"`);
};
