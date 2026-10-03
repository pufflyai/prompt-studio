import { z } from "zod";
import {
  VIEW_FILTER_CONDITIONS,
  type ViewFieldKind,
  type ViewFilterCondition,
  type ViewFilterGroup,
  type ViewFilterRule,
  type ViewSort,
} from "../extension-kernel/types/collection-view";

export const EMPTY_VIEW_FILTER: ViewFilterGroup = { conjunction: "and", rules: [] };
export const VIEW_DAY_PATTERN = /^(\d{4}-\d{2}-\d{2}|today([+-]\d+)?)$/;

const conditionIds = [...new Set(Object.values(VIEW_FILTER_CONDITIONS).flat())] as [
  ViewFilterCondition,
  ...ViewFilterCondition[],
];

export const viewFilterConditionSchema = z.enum(conditionIds);

export const viewFilterRuleSchema = z.object({
  attributeId: z.string().min(1),
  condition: viewFilterConditionSchema,
  value: z.union([z.boolean(), z.string(), z.number(), z.array(z.string())]).optional(),
});
const advancedFilterGroupSchema = z.strictObject({
  conjunction: z.enum(["and", "or"]),
  rules: z.array(viewFilterRuleSchema),
});
export const viewFilterGroupSchema = advancedFilterGroupSchema
  .extend({
    groups: z.array(advancedFilterGroupSchema).optional(),
  })
  .refine((filter) => !filter.groups?.length || filter.conjunction === "and", {
    message: "Normal rules and advanced groups combine using AND",
  });

const viewSortSchema = z.object({ attributeId: z.string().min(1), direction: z.enum(["asc", "desc"]) });
export const viewSortsSchema = z.array(viewSortSchema).max(1, "A view allows only one sort");

/** What a rule's value must be for a condition the field kind accepts. */
export const viewFilterValueKind = (kind: ViewFieldKind, condition: ViewFilterCondition) => {
  if (condition === "is-empty" || condition === "is-not-empty") return "none" as const;
  if (condition === "is-any-of" || condition === "is-none-of") return "options" as const;
  if (kind === "boolean") return "boolean" as const;
  if (kind === "number") return "number" as const;
  if (kind === "date") return "day" as const;
  if (kind === "string") return "text" as const;
  return "options" as const;
};

const valueNeeds = {
  none: "takes no value",
  boolean: "needs a boolean",
  number: "needs a number",
  day: "needs a day such as 2026-10-02, today, or today-7",
  text: "needs text",
  options: "needs a list of option values",
};

/** A missing value marks a rule that is still being built. The renderer ignores it. */
const valueFits = (value: ViewFilterRule["value"], kind: ReturnType<typeof viewFilterValueKind>) => {
  if (value === undefined) return true;
  if (kind === "none") return false;
  if (kind === "boolean") return typeof value === "boolean";
  if (kind === "number") return typeof value === "number" && Number.isFinite(value);
  if (kind === "day") return typeof value === "string" && VIEW_DAY_PATTERN.test(value);
  if (kind === "text") return typeof value === "string";
  return Array.isArray(value);
};

export interface ViewRuleField {
  id: string;
  kind: ViewFieldKind;
  filterable: boolean;
  sortable: boolean;
  options?: { value: string }[];
}

/** enum-multi fields hold several values, so one order does not exist. */
export const canSortViewField = (field: Pick<ViewRuleField, "kind" | "sortable">) =>
  field.sortable && field.kind !== "enum-multi";

const ruleProblem = (rule: ViewFilterRule, fields: ViewRuleField[]) => {
  const filterable = fields.filter((field) => field.filterable);
  const field = filterable.find((field) => field.id === rule.attributeId);
  if (!field)
    return `Invalid filter field "${rule.attributeId}". Valid IDs: ${filterable.map((field) => field.id).join(", ")}`;
  const conditions = VIEW_FILTER_CONDITIONS[field.kind];
  // Deprecated filter maps used exact value lists on scalar fields too. Keep them editable.
  const legacyList =
    ["is-any-of", "is-none-of"].includes(rule.condition) && ["string", "number", "date"].includes(field.kind);
  if (!conditions.includes(rule.condition) && !legacyList)
    return `Field "${field.id}" does not accept "${rule.condition}". Valid conditions: ${conditions.join(", ")}`;
  const valueKind = viewFilterValueKind(field.kind, rule.condition);
  if (!valueFits(rule.value, valueKind))
    return `Condition "${rule.condition}" on "${field.id}" ${valueNeeds[valueKind]}`;
  const options = field.options;
  const values = Array.isArray(rule.value) ? rule.value : [];
  const unknown = options ? values.find((value) => !options.some((option) => option.value === value)) : undefined;
  if (options && unknown !== undefined)
    return `Invalid filter value "${unknown}" for "${field.id}". Valid values: ${options.map((option) => option.value).join(", ")}`;
  return undefined;
};

/** The first reason the filter does not fit the fields, or undefined. */
export const findViewFilterProblem = (filter: ViewFilterGroup, fields: ViewRuleField[]) => {
  for (const rule of [...filter.rules, ...(filter.groups ?? []).flatMap((group) => group.rules)]) {
    const problem = ruleProblem(rule, fields);
    if (problem) return problem;
  }
  return undefined;
};

/** The first reason the sorts do not fit the fields, or undefined. */
export const findViewSortsProblem = (sorts: ViewSort[], fields: ViewRuleField[]) => {
  if (sorts.length > 1) return "A view allows only one sort";
  const sortable = fields.filter(canSortViewField).map((field) => field.id);
  for (const sort of sorts) {
    if (!sortable.includes(sort.attributeId))
      return `Invalid sort field "${sort.attributeId}". Valid IDs: ${sortable.join(", ")}`;
  }
  return undefined;
};
