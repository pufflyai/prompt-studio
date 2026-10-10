import type { ViewFilterGroup, ViewFilterRule } from "@pstdio/sdk/extensions";
import { filterRowsByView } from "../collection-view/collection-view-filter";
import { getEnumOptions } from "./kanban-renderer-helpers";
import type { AttributeDescriptor } from "./types";

const branches = (group: ViewFilterGroup) => {
  const children: ViewFilterRule[][][] = (group.groups ?? []).map(branches);
  if (group.conjunction === "or") return [...group.rules.map((rule) => [rule]), ...children.flat()];
  return children.reduce(
    (parents, alternatives) => parents.flatMap((parent) => alternatives.map((child) => [...parent, ...child])),
    [group.rules],
  );
};

const candidateValues = (attribute: AttributeDescriptor, rules: ViewFilterRule[]) => {
  const positive = rules.filter((rule) =>
    ["is", "contains", "is-any-of", "has-any-of", "has-all-of"].includes(rule.condition),
  );
  const values = positive.flatMap((rule) => (rule.value === undefined ? [] : [rule.value])).flat();
  const options = getEnumOptions(attribute.type).map((option) => option.value);
  if (attribute.type.kind !== "enum-multi") return [...values, ...options, ""];
  const excluded = rules
    .filter((rule) => ["has-none-of", "is-none-of"].includes(rule.condition))
    .flatMap((rule) => rule.value ?? [])
    .flat();
  const selected = [...new Set(values)].filter((value) => !excluded.includes(value));
  return [selected, ...options.map((value) => [value]), []];
};

/** Use the same filter semantics as the board, including alternatives and exclusions. */
export const getCreateAttributeValues = (
  attributes: AttributeDescriptor[],
  columnAttributeId: string | undefined,
  columnId: string,
  filter: ViewFilterGroup = { conjunction: "and", rules: [] },
) => {
  const editable = attributes.filter((attribute) => attribute.editable);
  const empty: Record<string, unknown> = Object.fromEntries(
    editable.map((attribute) => {
      const value = attribute.type.kind === "enum-multi" ? [] : "";
      return [attribute.id, attribute.id === columnAttributeId ? columnId : value];
    }),
  );
  const editableIds = new Set(editable.map((attribute) => attribute.id));
  const readOnlyRuleCount = (rules: ViewFilterRule[]) =>
    rules.filter((rule) => !editableIds.has(rule.attributeId)).length;
  // Prefer a branch whose properties the form can choose. A read-only rule
  // (such as Created before a date) cannot be assumed to match a new row.
  const alternatives = branches(filter).sort((left, right) => readOnlyRuleCount(left) - readOnlyRuleCount(right));
  for (const rules of alternatives) {
    const result = { ...empty };
    let matches = true;
    for (const attribute of editable) {
      const fieldRules = rules.filter((rule) => rule.attributeId === attribute.id);
      if (fieldRules.length === 0) continue;
      const candidates = attribute.id === columnAttributeId ? [columnId] : candidateValues(attribute, fieldRules);
      const matching = candidates.find(
        (value) =>
          filterRowsByView(
            [{ id: "draft", title: "", attributes: { [attribute.id]: value } }],
            { conjunction: "and", rules: fieldRules },
            [attribute],
          ).length > 0,
      );
      if (matching === undefined) {
        matches = false;
        break;
      }
      result[attribute.id] = matching;
    }
    if (matches) return result;
  }
  return empty;
};
