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
    if (rule.value === undefined || rule.value === null) return false;
    if (field.type.kind === "number") return rule.value !== "" && Number.isFinite(Number(rule.value));
    return true;
  });
  const groups: ViewFilterGroup[] = (filter.groups ?? []).flatMap((group) => {
    const usable: ViewFilterGroup | undefined = usableAutoBuildIgnore(group, fields);
    return usable ? [usable] : [];
  });
  return rules.length || groups.length ? { ...filter, rules, groups } : undefined;
}
