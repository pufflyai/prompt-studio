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
export const NESTED_GROUP_PROBLEM = "A nested group may hold rules only";
export const VIEW_DAY_PATTERN = /^(\d{4}-\d{2}-\d{2}|today([+-]\d+)?)$/;

const conditionIds = [...new Set(Object.values(VIEW_FILTER_CONDITIONS).flat())] as [
  ViewFilterCondition,
  ...ViewFilterCondition[],
];

export const viewFilterConditionSchema = z.enum(conditionIds);

export const viewFilterRuleSchema = z.object({
  attributeId: z.string().min(1),
  condition: viewFilterConditionSchema,
  value: z.union([z.string(), z.number(), z.array(z.string())]).optional(),
});
const groupOf = <T extends z.ZodType>(rule: T) =>
  z.object({ conjunction: z.enum(["and", "or"]), rules: z.array(rule) });

export const isViewFilterGroup = (rule: ViewFilterRule | ViewFilterGroup): rule is ViewFilterGroup =>
  "conjunction" in rule;

const hasTooDeepGroup = (filter: ViewFilterGroup) =>
  filter.rules.some((rule) => isViewFilterGroup(rule) && rule.rules.some(isViewFilterGroup));

// The shape accepts one level more than the model allows, so the refine can explain the limit.
export const viewFilterGroupSchema = groupOf(
  z.union([viewFilterRuleSchema, groupOf(z.union([viewFilterRuleSchema, groupOf(viewFilterRuleSchema)]))]),
).refine((filter) => !hasTooDeepGroup(filter), { message: NESTED_GROUP_PROBLEM });

export const viewSortSchema = z.object({ attributeId: z.string().min(1), direction: z.enum(["asc", "desc"]) });

/** What a rule's value must be for a condition the field kind accepts. */
export const viewFilterValueKind = (kind: ViewFieldKind, condition: ViewFilterCondition) => {
  if (condition === "is-empty" || condition === "is-not-empty") return "none" as const;
  if (kind === "number") return "number" as const;
  if (kind === "date") return "day" as const;
  if (kind === "string") return "text" as const;
  return "options" as const;
};

const valueNeeds = {
  none: "takes no value",
  number: "needs a number",
  day: "needs a day such as 2026-10-02, today, or today-7",
  text: "needs text",
  options: "needs a list of option values",
};

/** A missing value marks a rule that is still being built. The renderer ignores it. */
const valueFits = (value: ViewFilterRule["value"], kind: ReturnType<typeof viewFilterValueKind>) => {
  if (value === undefined) return true;
  if (kind === "none") return false;
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
  if (!conditions.includes(rule.condition))
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
  if (hasTooDeepGroup(filter)) return NESTED_GROUP_PROBLEM;
  const rules = filter.rules.flatMap((rule) => (isViewFilterGroup(rule) ? rule.rules : [rule])) as ViewFilterRule[];
  for (const rule of rules) {
    const problem = ruleProblem(rule, fields);
    if (problem) return problem;
  }
  return undefined;
};

/** The first reason the sorts do not fit the fields, or undefined. */
export const findViewSortsProblem = (sorts: ViewSort[], fields: ViewRuleField[]) => {
  const sortable = fields.filter(canSortViewField).map((field) => field.id);
  for (const [index, sort] of sorts.entries()) {
    if (!sortable.includes(sort.attributeId))
      return `Invalid sort field "${sort.attributeId}". Valid IDs: ${sortable.join(", ")}`;
    if (sorts.findIndex((other) => other.attributeId === sort.attributeId) !== index)
      return `Sort field "${sort.attributeId}" appears more than once`;
  }
  return undefined;
};
