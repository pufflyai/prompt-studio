import type { CollectionChange } from "./collections";

export const updateCollectionIndexes = (
  fields: Map<string, Map<unknown, Set<string>>> | undefined,
  change: CollectionChange,
) => {
  for (const [field, index] of fields ?? []) {
    for (const row of change.changes) {
      const previous = row.previousValue?.[field];
      const ids = index.get(previous);
      ids?.delete(row.key);
      if (ids?.size === 0) index.delete(previous);
      if (!row.value) continue;
      const value = row.value[field];
      const next = index.get(value) ?? new Set<string>();
      next.add(row.key);
      index.set(value, next);
    }
  }
};
