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
const isAnyOf = (rule: ViewFilterRule) => rule.condition === "is-any-of" || rule.condition === "has-any-of";

/** The picker edits one list rule per field, using the view's chosen conjunction. */
export const quickOptionValues = (filter: ViewFilterGroup, attributeId: string) => {
  const rule = filter.rules.find((entry) => entry.attributeId === attributeId && isAnyOf(entry));
  return rule && Array.isArray(rule.value) ? rule.value : [];
};
export const setQuickOptions = (filter: ViewFilterGroup, field: AttributeDescriptor, values: string[]) => {
  const index = filter.rules.findIndex((entry) => entry.attributeId === field.id && isAnyOf(entry));
  const rule: ViewFilterRule | undefined = values.length
    ? { attributeId: field.id, condition: defaultCondition(field), value: values }
    : undefined;
  if (index === -1) return rule ? addRule(filter, rule) : filter;
  return setRuleAt(filter, index, rule);
};
export const clearQuickOptions = (filter: ViewFilterGroup, attributeId: string): ViewFilterGroup => ({
  ...filter,
  rules: filter.rules.filter((entry) => entry.attributeId !== attributeId || !isAnyOf(entry)),
});

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
