import type { ViewFilterGroup, ViewFilterRule } from "@pstdio/sdk/extensions";
import type { AttributeDescriptor } from "../kanban-renderer/types";
import { fieldConditions } from "./collection-view-fields";
import { isFilterGroup } from "./collection-view-filter";

/** A rule's place in the filter: its index in the root group, then its index in a nested group. */
export type RulePath = [number] | [number, number];

export const defaultCondition = (field: AttributeDescriptor) => fieldConditions(field)[0]!;

export const newRule = (field: AttributeDescriptor): ViewFilterRule => ({
  attributeId: field.id,
  condition: defaultCondition(field),
  ...(field.type.kind === "boolean" ? { value: true } : {}),
});

export const ruleAt = (filter: ViewFilterGroup, path: RulePath) => {
  const root = filter.rules[path[0]];
  if (!root) return undefined;
  if (path.length === 1) return isFilterGroup(root) ? undefined : root;
  if (!isFilterGroup(root)) return undefined;
  return root.rules[path[1]] as ViewFilterRule | undefined;
};

const replaceAt = <T>(list: T[], index: number, next: T | undefined) =>
  next === undefined
    ? list.filter((_, entry) => entry !== index)
    : list.map((item, entry) => (entry === index ? next : item));

/** Writes or removes one rule. A nested group that loses its last rule goes away with it. */
export const setRuleAt = (
  filter: ViewFilterGroup,
  path: RulePath,
  rule: ViewFilterRule | undefined,
): ViewFilterGroup => {
  if (path.length === 1) return { ...filter, rules: replaceAt(filter.rules, path[0], rule) };
  const group = filter.rules[path[0]];
  if (!group || !isFilterGroup(group)) return filter;
  const rules = replaceAt(group.rules, path[1], rule);
  return { ...filter, rules: replaceAt(filter.rules, path[0], rules.length ? { ...group, rules } : undefined) };
};

export const removeGroupAt = (filter: ViewFilterGroup, index: number): ViewFilterGroup => ({
  ...filter,
  rules: replaceAt(filter.rules, index, undefined),
});

export const addRule = (filter: ViewFilterGroup, rule: ViewFilterRule, groupIndex?: number): ViewFilterGroup => {
  if (groupIndex === undefined) return { ...filter, rules: [...filter.rules, rule] };
  const group = filter.rules[groupIndex];
  if (!group || !isFilterGroup(group)) return filter;
  return { ...filter, rules: replaceAt(filter.rules, groupIndex, { ...group, rules: [...group.rules, rule] }) };
};

/** "A and (B or C)" is the case people ask for, so a new group joins its rules the other way. */
export const addGroup = (filter: ViewFilterGroup, rule: ViewFilterRule): ViewFilterGroup => ({
  ...filter,
  rules: [...filter.rules, { conjunction: filter.conjunction === "and" ? "or" : "and", rules: [rule] }],
});

export const setConjunction = (
  filter: ViewFilterGroup,
  conjunction: ViewFilterGroup["conjunction"],
  groupIndex?: number,
): ViewFilterGroup => {
  if (groupIndex === undefined) return { ...filter, conjunction };
  const group = filter.rules[groupIndex];
  if (!group || !isFilterGroup(group)) return filter;
  return { ...filter, rules: replaceAt(filter.rules, groupIndex, { ...group, conjunction }) };
};

const isAnyOf = (rule: ViewFilterRule) => rule.condition === "is-any-of" || rule.condition === "has-any-of";

/** The quick picker edits one "is any of" rule per field at the root of an "and" filter. */
export const quickOptionValues = (filter: ViewFilterGroup, attributeId: string) => {
  if (filter.conjunction !== "and") return [];
  const rule = filter.rules.find(
    (entry) => !isFilterGroup(entry) && entry.attributeId === attributeId && isAnyOf(entry),
  );
  return rule && !isFilterGroup(rule) && Array.isArray(rule.value) ? rule.value : [];
};

// A quick rule must narrow what the view shows, so an "or" root moves into a group when it can.
const andRoot = (filter: ViewFilterGroup): ViewFilterGroup => {
  if (filter.conjunction === "and" || filter.rules.length === 0) return { ...filter, conjunction: "and" };
  if (filter.rules.some(isFilterGroup)) return filter;
  return { conjunction: "and", rules: [{ conjunction: "or", rules: filter.rules }] };
};

export const setQuickOptions = (filter: ViewFilterGroup, field: AttributeDescriptor, values: string[]) => {
  const base = andRoot(filter);
  const index = base.rules.findIndex(
    (entry) => !isFilterGroup(entry) && entry.attributeId === field.id && isAnyOf(entry),
  );
  const rule: ViewFilterRule | undefined = values.length
    ? { attributeId: field.id, condition: defaultCondition(field), value: values }
    : undefined;
  if (index === -1) return rule ? addRule(base, rule) : filter;
  return setRuleAt(base, [index], rule);
};

export const clearQuickOptions = (filter: ViewFilterGroup, attributeId: string): ViewFilterGroup => ({
  ...filter,
  rules: filter.rules.filter((entry) => isFilterGroup(entry) || entry.attributeId !== attributeId || !isAnyOf(entry)),
});
