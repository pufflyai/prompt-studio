import type { StorageRecordIndex } from "pstdio-sync-contracts";

/** Resolve extension collection declarations before installing local storage indexes. */
export const resolveCollectionIndexes = (indexes: StorageRecordIndex[], scopeType: string, scopeId: string) =>
  indexes.map((index) => {
    if (index.collection === undefined) return index;
    const { collection, prefix, fields, ...definition } = index;
    if (!collection || prefix !== undefined)
      throw new Error("A collection index needs a name and cannot also set prefix");
    return {
      ...definition,
      prefix: `${JSON.stringify([scopeType, scopeId, "collection", collection]).slice(0, -1)},`,
      fields: Object.fromEntries(
        Object.entries(fields).map(([name, field]) => [
          name,
          {
            ...field,
            path: ["value", ...field.path],
          },
        ]),
      ),
    };
  });
