/** The value used by table filters and sorts, independent of its rendered label. */
export const resolveDataTableComparableValue = (value: unknown, renderer?: { type: string }) => {
  if (typeof value !== "object" || value === null) return value;
  if ("display" in value) return "sortValue" in value ? value.sortValue : undefined;
  if (
    renderer?.type === "diff" &&
    "additions" in value &&
    "deletions" in value &&
    typeof value.additions === "number" &&
    typeof value.deletions === "number"
  )
    return value.additions + value.deletions;
  return value;
};

/** The host and renderer must offer the same conditions for a column. */
export const resolveDataTableFieldKind = (
  values: unknown[],
  column: { type?: "string" | "number" | "date"; renderer?: { type: string } } = {},
) => {
  if (column.type) return column.type;
  if (column.renderer?.type === "date") return "date";
  const comparable = values
    .map((value) => resolveDataTableComparableValue(value, column.renderer))
    .filter((value) => value !== null && value !== undefined);
  return comparable.length > 0 && comparable.every((value) => typeof value === "number") ? "number" : "string";
};
