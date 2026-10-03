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
/** Selecting a categorical value replaces an empty predicate in the same edit. */
export const selectRuleValues = (
  field: AttributeDescriptor,
  rule: ViewFilterRule,
  value: ViewFilterRule["value"],
): ViewFilterRule => {
  if (field.type.kind === "boolean" && typeof value === "boolean") {
    const negative = rule.condition === "is-not";
    return { attributeId: field.id, condition: negative ? "is-not" : "is", value: negative ? !value : value };
  }
  let condition = rule.condition;
  if (Array.isArray(value) && (condition === "is-empty" || condition === "is-not-empty")) {
    const negative = condition === "is-not-empty";
    if (field.type.kind === "enum-multi") condition = negative ? "has-none-of" : "has-any-of";
    else condition = negative ? "is-none-of" : "is-any-of";
  }
  return { ...rule, condition, value };
};
