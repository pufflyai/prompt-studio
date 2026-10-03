import { normalizeBooleanViewRule, type ViewFilterGroup } from "@pstdio/sdk/extensions";
import type { AttributeDescriptor } from "../kanban-renderer/types";

/** Normalize saved values before editing or saving them, including unsaved local view state. */
export const normalizeBooleanViewFilter = (filter: ViewFilterGroup, fields: AttributeDescriptor[]): ViewFilterGroup => {
  const rules = filter.rules.map((rule) => {
    const field = fields.find((field) => field.id === rule.attributeId);
    return field ? normalizeBooleanViewRule(rule, field.type) : rule;
  });
  const groups = filter.groups?.map((group) => normalizeBooleanViewFilter(group, fields));
  const changed =
    rules.some((rule, index) => rule !== filter.rules[index]) ||
    groups?.some((group, index) => group !== filter.groups?.[index]);
  return changed ? { ...filter, rules, ...(groups ? { groups } : {}) } : filter;
};
