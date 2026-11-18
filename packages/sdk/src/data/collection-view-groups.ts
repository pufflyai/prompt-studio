import type { StorageComputedField, StorageExpression } from "pstdio-api-contracts/extension-kernel";
import type { CollectionQueryField } from "./collection-view-filter";

/** Native option groups combine missing and removed options into the empty group. */
export const collectionGroupSelection = (
  names: string[],
  fields: Record<string, CollectionQueryField>,
  computed: Record<string, StorageComputedField>,
) =>
  names
    .filter((name) => name !== "none" && fields[name])
    .map((name) => {
      const descriptor = fields[name];
      if (descriptor.kind !== "enum") return { field: name, indexField: descriptor.field };
      const known = new Set((descriptor.options ?? []).map(({ value }) => value));
      const source = computed[descriptor.field];
      const field = `@group:${name}`;
      if (source?.cases)
        computed[field] = {
          ...source,
          cases: source.cases.map((entry) => ({
            ...entry,
            value: typeof entry.value === "string" && known.has(entry.value) ? entry.value : null,
          })),
          otherwise: typeof source.otherwise === "string" && known.has(source.otherwise) ? source.otherwise : null,
        };
      else {
        const value: StorageExpression = source?.expression ?? { field: descriptor.field };
        computed[field] = {
          type: "string",
          expression: {
            op: "if",
            args: [
              { get: { literal: Object.fromEntries([...known].map((key) => [key, true])) }, key: value },
              value,
              { literal: null },
            ],
          },
        };
      }
      return { field: name, indexField: field };
    });
