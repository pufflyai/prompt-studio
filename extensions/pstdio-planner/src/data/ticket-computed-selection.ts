import type { StorageRecordQuery } from "@pstdio/sdk/extensions";

export const selectedTicketComputedFields = (
  computed: NonNullable<StorageRecordQuery["computed"]>,
  values: unknown[],
) => {
  const selected: NonNullable<StorageRecordQuery["computed"]> = {};
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) return value.forEach(visit);
    for (const [key, child] of Object.entries(value)) {
      if (key === "literal") continue;
      if (key === "field" && typeof child === "string" && computed[child] && !selected[child]) {
        selected[child] = computed[child];
        visit(selected[child]);
      }
      visit(child);
    }
  };
  values.forEach(visit);
  return selected;
};
