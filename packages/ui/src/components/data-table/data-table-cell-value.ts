export { resolveDataTableComparableValue } from "@pstdio/sdk/extensions";

import type { DataTableDiffValue } from "./types";

export const isDataTableDiffValue = (value: unknown): value is DataTableDiffValue =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as DataTableDiffValue).additions === "number" &&
  typeof (value as DataTableDiffValue).deletions === "number";
