import { normalizeBooleanViewRule, type ViewFilterGroup } from "@pstdio/sdk/extensions";
import type { AttributeDescriptor } from "../kanban-renderer/types";

/** Normalize saved values before editing or saving them, including unsaved local view state. */
export const normalizeBooleanViewFilter = (filter: ViewFilterGroup, fields: AttributeDescriptor[]): ViewFilterGroup => {
  const rules = filter.rules.map((rule) => {
    const field = fields.find((field) => field.id === rule.attributeId);
    return field ? normalizeBooleanViewRule(rule, field.type) : rule;
  });
  return rules.some((rule, index) => rule !== filter.rules[index]) ? { ...filter, rules } : filter;
};
