import type { ViewFilterGroup, ViewFilterRule } from "@pstdio/sdk/extensions";
import type { AttributeDescriptor } from "../kanban-renderer/types";
import { fieldConditions } from "./collection-view-fields";

export const defaultCondition = (field: AttributeDescriptor) => fieldConditions(field)[0]!;
export const newRule = (field: AttributeDescriptor): ViewFilterRule => ({
  attributeId: field.id,
  condition: defaultCondition(field),
  ...(field.type.kind === "boolean" ? { value: true } : {}),
});

export const setRuleAt = (
  filter: ViewFilterGroup,
  index: number,
  rule: ViewFilterRule | undefined,
): ViewFilterGroup => ({
  ...filter,
  rules:
    rule === undefined
      ? filter.rules.filter((_, entry) => entry !== index)
      : filter.rules.map((item, entry) => (entry === index ? rule : item)),
});
export const addRule = (filter: ViewFilterGroup, rule: ViewFilterRule): ViewFilterGroup => ({
  ...filter,
  rules: [...filter.rules, rule],
});
export const setConjunction = (
  filter: ViewFilterGroup,
  conjunction: ViewFilterGroup["conjunction"],
): ViewFilterGroup => ({
  ...filter,
  conjunction,
});
const isOptionRule = (rule: ViewFilterRule) =>
  Array.isArray(rule.value) ||
  ["is-any-of", "is-none-of", "has-any-of", "has-all-of", "has-none-of", "is-empty", "is-not-empty"].includes(
    rule.condition,
  );

/** The picker edits the field's existing selection without changing its predicate. */
export const quickOptionValues = (filter: ViewFilterGroup, attributeId: string) => {
  const rule = filter.rules.find((entry) => entry.attributeId === attributeId && isOptionRule(entry));
  return rule && Array.isArray(rule.value) ? rule.value : [];
};
export const setQuickOptions = (filter: ViewFilterGroup, field: AttributeDescriptor, values: string[]) => {
  const index = filter.rules.findIndex((entry) => entry.attributeId === field.id && isOptionRule(entry));
  const existing = filter.rules[index];
  const rule: ViewFilterRule | undefined = values.length
    ? selectRuleValues(field, existing ?? newRule(field), values)
    : undefined;
  if (index === -1) return rule ? addRule(filter, rule) : filter;
  return setRuleAt(filter, index, rule);
};

/** Selecting a categorical value replaces an empty predicate in the same edit. */
export const selectRuleValues = (
  field: AttributeDescriptor,
  rule: ViewFilterRule,
  value: ViewFilterRule["value"],
): ViewFilterRule => {
  let condition = rule.condition;
  if (Array.isArray(value) && (condition === "is-empty" || condition === "is-not-empty")) {
    const negative = condition === "is-not-empty";
    if (field.type.kind === "enum-multi") condition = negative ? "has-none-of" : "has-any-of";
    else condition = negative ? "is-none-of" : "is-any-of";
  }
  return { ...rule, condition, value };
};
