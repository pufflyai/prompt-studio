import { isDisplayValue } from "./helpers";
import type { DataTableColumnRenderer, DataTableDiffValue } from "./types";

export const isDataTableDiffValue = (value: unknown): value is DataTableDiffValue =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as DataTableDiffValue).additions === "number" &&
  typeof (value as DataTableDiffValue).deletions === "number";

// The value that sorting and filtering compare, so structured cell values never compare as "[object Object]".
export const resolveDataTableComparableValue = (value: unknown, renderer?: DataTableColumnRenderer) => {
  if (isDisplayValue(value)) return value.sortValue;
  if (renderer?.type === "diff" && isDataTableDiffValue(value)) return value.additions + value.deletions;
  return value;
};
