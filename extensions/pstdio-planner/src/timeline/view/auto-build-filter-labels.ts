import { normalizeBooleanViewRule, type ViewFilterRule } from "@pstdio/sdk/extensions";
import type { AttributeDescriptor } from "@pstdio/ui/kanban-renderer";

const comparisonLabels: Record<string, string> = { gt: ">", gte: "≥", lt: "<", lte: "≤" };

function conditionLabel(rule: ViewFilterRule, field?: AttributeDescriptor) {
  const boolean = field?.type.kind === "boolean";
  let condition = comparisonLabels[rule.condition] ?? rule.condition.replaceAll("-", " ");
  if (Array.isArray(rule.value) && rule.value.length === 1 && rule.condition === "is-any-of") condition = "is";
  if (["is-none-of", "has-none-of"].includes(rule.condition)) condition = "is not";
  if (boolean && rule.value === false && rule.condition === "is") condition = "is not";
  if (boolean && rule.value === false && rule.condition === "is-not") condition = "is";
  return condition;
}

function dateLabel(value: string) {
  const relative = /^today([+-])(\d+)$/.exec(value);
  if (relative) {
    const days = Number(relative[2]);
    const unit = days === 1 ? "day" : "days";
    return relative[1] === "-" ? `${days} ${unit} ago` : `in ${days} ${unit}`;
  }
  if (value !== "today") {
    const date = new Date(`${value}T00:00:00`);
    if (!Number.isNaN(date.getTime())) return date.toLocaleDateString();
  }
  return value;
}

function valueLabel(rule: ViewFilterRule, field?: AttributeDescriptor) {
  const boolean = field?.type.kind === "boolean";
  const label = field?.label ?? rule.attributeId;
  let value = rule.value === undefined ? "" : String(rule.value);
  if (boolean) value = rule.value === undefined ? "" : label;
  if (Array.isArray(rule.value)) {
    value = rule.value
      .map((entry) => {
        if ((field?.type.kind === "enum" || field?.type.kind === "enum-multi") && Array.isArray(field.type.options))
          return field.type.options.find(({ value }) => value === entry)?.label ?? entry;
        return entry;
      })
      .join(", ");
  }
  if (field?.type.kind === "date" && typeof rule.value === "string") return dateLabel(rule.value);
  return value;
}

export function autoBuildRuleParts(saved: ViewFilterRule, fields: AttributeDescriptor[], itemLabel: string) {
  const field = fields.find(({ id }) => id === saved.attributeId);
  const rule = field ? normalizeBooleanViewRule(saved, field.type) : saved;
  const label = field?.type.kind === "boolean" ? itemLabel : (field?.label ?? rule.attributeId);
  return [label, conditionLabel(rule, field), valueLabel(rule, field)].filter(Boolean);
}
