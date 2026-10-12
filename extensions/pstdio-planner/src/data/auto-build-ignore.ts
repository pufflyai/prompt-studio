import { VIEW_FILTER_CONDITIONS, type ViewFilterGroup } from "@pstdio/sdk/extensions";
import type { AttributeDescriptor } from "@pstdio/ui/kanban-renderer";

/** Incomplete picker groups and removed fields do not exclude the entire board. */
export function usableAutoBuildIgnore(filter: ViewFilterGroup, fields: AttributeDescriptor[]) {
  const rules = filter.rules.filter((rule) => {
    const field = fields.find((field) => field.id === rule.attributeId && field.filterable);
    if (!field) return false;
    const conditions = VIEW_FILTER_CONDITIONS[field.type.kind];
    if (!conditions.includes(rule.condition)) return false;
    if (rule.condition === "is-empty" || rule.condition === "is-not-empty") return true;
    if (["is-any-of", "is-none-of", "has-any-of", "has-none-of", "has-all-of"].includes(rule.condition))
      return Array.isArray(rule.value) && rule.value.length > 0;
    if (field.type.kind === "number") return typeof rule.value === "number" && Number.isFinite(rule.value);
    if (field.type.kind === "boolean") return typeof rule.value === "boolean";
    if (field.type.kind === "date")
      return typeof rule.value === "string" && /^(today([+-]\d+)?|\d{4}-\d{2}-\d{2})$/.test(rule.value);
    return field.type.kind === "string" && typeof rule.value === "string" && rule.value !== "";
  });
  const groups: ViewFilterGroup[] = (filter.groups ?? []).flatMap((group) => {
    const usable: ViewFilterGroup | undefined = usableAutoBuildIgnore(group, fields);
    return usable ? [usable] : [];
  });
  return rules.length || groups.length ? { ...filter, rules, groups } : undefined;
}
