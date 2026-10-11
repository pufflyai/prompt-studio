import type { ViewFilterGroup } from "@pstdio/sdk/extensions";
import type { AttributeDescriptor } from "@pstdio/ui/kanban-renderer";

// Display filters ignore removed fields. A saved launch selection must stop instead.
export function autoBuildFiltersAvailable(filter: ViewFilterGroup, fields: AttributeDescriptor[]) {
  const pending = [filter];
  while (pending.length) {
    const group = pending.pop()!;
    pending.push(...(group.groups ?? []));
    for (const rule of group.rules) {
      const field = fields.find(({ id }) => id === rule.attributeId);
      if (!field || field.filterable === false) return false;
      if (field.type.kind !== "enum" && field.type.kind !== "enum-multi") continue;
      const options = field.type.options;
      if (
        Array.isArray(rule.value) &&
        Array.isArray(options) &&
        !rule.value.every((value) => options.some((option) => option.value === value))
      )
        return false;
    }
  }
  return true;
}
