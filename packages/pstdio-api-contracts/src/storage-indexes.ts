import type { StorageRecordIndex } from "pstdio-sync-contracts";

/** Resolve extension collection and record key declarations before installing local storage indexes. */
export const resolveCollectionIndexes = (indexes: StorageRecordIndex[], scopeType: string, scopeId: string) =>
  indexes.map((index) => {
    if (index.keyPrefix !== undefined) {
      const { keyPrefix, ...definition } = index;
      if (!keyPrefix || index.prefix !== undefined || index.collection !== undefined)
        throw new Error("A key prefix index needs a prefix and cannot also set prefix or collection");
      // The address prefix of records.id(keyPrefix + key): drop the closing quote and bracket.
      return { ...definition, prefix: JSON.stringify([scopeType, scopeId, "kv", keyPrefix]).slice(0, -2) };
    }
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
            ...(!field.lookup && { path: ["value", ...(field.path ?? [])] }),
            ...(field.derive
              ? {
                  derive: {
                    ...field.derive,
                    ...(field.derive.kind === "markdownTitle" && field.derive.fallbackPath
                      ? { fallbackPath: ["value", ...field.derive.fallbackPath] }
                      : {}),
                    ...(field.derive.kind === "selection" || field.derive.kind === "selections"
                      ? { selectionPath: ["value", ...field.derive.selectionPath] }
                      : {}),
                  },
                }
              : {}),
          },
        ]),
      ),
    };
  });
