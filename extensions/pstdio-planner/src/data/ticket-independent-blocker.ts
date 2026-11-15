import type { StoragePredicate } from "@pstdio/sdk/extensions";

// Old agents wrote dependency waiting as prose. It is independent only when that
// strict legacy sentence cannot resolve uniquely to active linked prerequisites.
export const dependencyOnlyBlocker: StoragePredicate = {
  exists: {
    index: "ticket-view",
    on: [{ sourceField: "dependsOn", relatedField: "id", op: "contains" }],
    every: { field: "dependencyReasonRefs", as: "blockerRef", matches: "one" },
    where: {
      all: [
        { field: "archived", op: "ne", value: true },
        {
          test: {
            op: "or",
            args: [
              { op: "equalsIgnoreCase", args: [{ field: "shorthand" }, { variable: "blockerRef" }] },
              {
                each: { field: "aliases" },
                as: "alias",
                mode: "some",
                where: { op: "equalsIgnoreCase", args: [{ variable: "alias" }, { variable: "blockerRef" }] },
              },
            ],
          },
        },
      ],
    },
  },
};

export const independentBlocker: StoragePredicate = {
  all: [{ test: { op: "nonblank", args: [{ field: "blockedReason" }] } }, { not: dependencyOnlyBlocker }],
};
