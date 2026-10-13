import { VIEW_FILTER_CONDITIONS, type ViewFilterGroup } from "@pstdio/sdk/extensions";
import { filterRowsByView } from "@pstdio/ui/collection-view";
import type { AttributeDescriptor, KanbanRendererRow } from "@pstdio/ui/kanban-renderer";

interface AutoBuildFilterResult {
  filter: ViewFilterGroup | undefined;
  complete: boolean;
}

export function readAutoBuildFilter(filter: ViewFilterGroup, fields: AttributeDescriptor[]) {
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
  const nested: AutoBuildFilterResult[] = (filter.groups ?? []).map((group) => readAutoBuildFilter(group, fields));
  const groups = nested.flatMap(({ filter }) => (filter ? [filter] : []));
  return {
    filter: rules.length || groups.length ? { ...filter, rules, groups } : undefined,
    complete: rules.length === filter.rules.length && nested.every(({ complete }) => complete),
  };
}

export function readAutoBuildTicketFilters(
  eligible: ViewFilterGroup,
  ignore: ViewFilterGroup,
  rows: KanbanRendererRow[],
  fields: AttributeDescriptor[],
) {
  const eligibility = readAutoBuildFilter(eligible, fields);
  const ignored = readAutoBuildFilter(ignore, fields).filter;
  return {
    eligible: new Set(
      (eligibility.filter ? filterRowsByView(rows, eligibility.filter, fields) : rows).map(({ id }) => id),
    ),
    ignored: new Set(ignored ? filterRowsByView(rows, ignored, fields).map(({ id }) => id) : []),
    configurationError: eligibility.complete ? null : "Complete or remove invalid eligible ticket filters.",
  };
}
