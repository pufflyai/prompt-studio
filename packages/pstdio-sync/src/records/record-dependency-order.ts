import type { StorageRecordIndex, StorageRecordQuery } from "pstdio-sync-contracts";
import { queryField } from "./record-query-field";

export const validateDependencyOrder = (index: StorageRecordIndex, query: StorageRecordQuery) => {
  if (!query.dependencyOrder) return;
  if (query.cursor || query.offset || (query.limit ?? 100) > 100)
    throw new Error("Dependency order selects at most 100 remaining records without a cursor or offset");
  const { idField, dependenciesField } = query.dependencyOrder;
  if (queryField(index, idField).type !== "string" || queryField(index, dependenciesField).type !== "array")
    throw new Error("Dependency order needs a string ID and a string-array dependency field");
};

/** The in-memory backend already owns its records; mirror the database's bounded first-ready result. */
export const orderDependencyRecords = <T>(
  items: T[],
  idOf: (item: T) => unknown,
  dependenciesOf: (item: T) => unknown,
  limit: number,
) => {
  const pending = [...items];
  const present = new Set(items.map(idOf));
  const placed = new Set<unknown>();
  const selected: T[] = [];
  while (pending.length && selected.length < limit) {
    const ready = pending.findIndex((item) => {
      const dependencies = dependenciesOf(item);
      return (
        !Array.isArray(dependencies) ||
        dependencies.every((id) => id === idOf(item) || !present.has(id) || placed.has(id))
      );
    });
    const [item] = pending.splice(Math.max(ready, 0), 1);
    selected.push(item);
    placed.add(idOf(item));
  }
  return selected;
};
