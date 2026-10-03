import type { ViewFilterCondition, ViewFilterGroup, ViewFilterRule, ViewSortDirection } from "@pstdio/sdk/extensions";
import { enumOptionLabel } from "../kanban-renderer/kanban-renderer-enum-helpers";
import type { AttributeDescriptor } from "../kanban-renderer/types";

const CONDITION_LABELS: Record<ViewFilterCondition, string> = {
  contains: "contains",
  "does-not-contain": "does not contain",
  is: "is",
  "is-not": "is not",
  gt: ">",
  gte: "≥",
  lt: "<",
  lte: "≤",
  "is-before": "is before",
  "is-after": "is after",
  "is-on-or-before": "is on or before",
  "is-on-or-after": "is on or after",
  "is-any-of": "is any of",
  "is-none-of": "is none of",
  "has-any-of": "has any of",
  "has-all-of": "has all of",
  "has-none-of": "has none of",
  "is-empty": "is empty",
  "is-not-empty": "is not empty",
};

/** The full condition name, as the condition select shows it. Numbers read as symbols. */
export const conditionLabel = (condition: ViewFilterCondition, field?: AttributeDescriptor) => {
  if (field?.type.kind === "number" && condition === "is") return "=";
  if (field?.type.kind === "number" && condition === "is-not") return "≠";
  return CONDITION_LABELS[condition];
};

/** A pill reads as a sentence, so a single option reads "is" or "is not". */
export const pillConditionLabel = (rule: ViewFilterRule, field?: AttributeDescriptor) => {
  if (
    field?.type.kind === "boolean" &&
    rule.value === false &&
    (rule.condition === "is" || rule.condition === "is-not")
  )
    return conditionLabel(rule.condition === "is" ? "is-not" : "is");
  const single = Array.isArray(rule.value) && rule.value.length === 1;
  if (single && rule.condition === "is-any-of") return "is";
  if (single && rule.condition === "is-none-of") return "is not";
  return conditionLabel(rule.condition, field);
};

const RELATIVE_DAY = /^today([+-])(\d+)$/;

export const dayLabel = (value: string) => {
  if (value === "today") return "today";
  const relative = RELATIVE_DAY.exec(value);
  if (relative) {
    const days = Number(relative[2]);
    const unit = days === 1 ? "day" : "days";
    return relative[1] === "-" ? `${days} ${unit} ago` : `in ${days} ${unit}`;
  }
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
};

export const optionLabel = (field: AttributeDescriptor | undefined, value: string) =>
  field ? enumOptionLabel(field.type, value) : value;

export const ruleValueLabel = (rule: ViewFilterRule, field?: AttributeDescriptor) => {
  const { value } = rule;
  if (value === undefined) return "";
  if (field?.type.kind === "boolean" && typeof value === "boolean") return field.label;
  if (Array.isArray(value)) return value.map((entry) => optionLabel(field, entry)).join(", ");
  if (field?.type.kind === "date" && typeof value === "string") return dayLabel(value);
  return String(value);
};

export const groupLead = (group: ViewFilterGroup) => (group.conjunction === "or" ? "Any of" : "All of");

/** A nested group, or a root joined by "or", reads as one pill. */
export const groupLabel = (group: ViewFilterGroup) =>
  `${groupLead(group)} ${group.rules.length} ${group.rules.length === 1 ? "rule" : "rules"}`;

const DIRECTION_LABELS: Record<string, [string, string]> = {
  boolean: ["False first", "True first"],
  number: ["1 → 9", "9 → 1"],
  date: ["Oldest first", "Newest first"],
  enum: ["Option order", "Reverse order"],
};

export const sortDirectionLabel = (field: AttributeDescriptor | undefined, direction: ViewSortDirection) => {
  const [ascending, descending] = DIRECTION_LABELS[field?.type.kind ?? ""] ?? ["A → Z", "Z → A"];
  return direction === "asc" ? ascending : descending;
};
