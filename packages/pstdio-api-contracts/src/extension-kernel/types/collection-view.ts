/** A condition that a filter rule applies to one field. Each field kind accepts a fixed list. */
export type ViewFilterCondition =
  | "contains"
  | "does-not-contain"
  | "is"
  | "is-not"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "is-before"
  | "is-after"
  | "is-on-or-before"
  | "is-on-or-after"
  | "is-any-of"
  | "is-none-of"
  | "has-any-of"
  | "has-all-of"
  | "has-none-of"
  | "is-empty"
  | "is-not-empty";

// Views travel through command params, so these are type aliases: they stay assignable to JSON values.
export type ViewFilterRule = {
  attributeId: string;
  condition: ViewFilterCondition;
  /**
   * Text, a number, a day ("2026-10-02", "today", "today-7", "today+7"),
   * or option values. Absent for is-empty and is-not-empty.
   */
  value?: boolean | string | number | string[];
};

export type ViewFilterGroup = {
  conjunction: "and" | "or";
  /** All rules share one conjunction. Filters have one level. */
  rules: ViewFilterRule[];
};

export type ViewSortDirection = "asc" | "desc";

export type ViewSort = {
  attributeId: string;
  direction: ViewSortDirection;
};

export type ViewFieldKind = "string" | "number" | "boolean" | "date" | "enum" | "status" | "enum-multi" | "user";

const optionConditions: readonly ViewFilterCondition[] = ["is-any-of", "is-none-of", "is-empty", "is-not-empty"];

/** The only list of conditions. The UI, the views API, and the CLI all read it. */
export const VIEW_FILTER_CONDITIONS: Record<ViewFieldKind, readonly ViewFilterCondition[]> = {
  boolean: ["is", "is-not", "is-empty", "is-not-empty"],
  string: ["contains", "does-not-contain", "is", "is-not", "is-empty", "is-not-empty"],
  number: ["is", "is-not", "gt", "gte", "lt", "lte", "is-empty", "is-not-empty"],
  date: ["is", "is-before", "is-after", "is-on-or-before", "is-on-or-after", "is-empty", "is-not-empty"],
  enum: optionConditions,
  status: optionConditions,
  user: optionConditions,
  "enum-multi": ["has-any-of", "has-all-of", "has-none-of", "is-empty", "is-not-empty"],
};
