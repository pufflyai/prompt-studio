import type {
  FilterExpression,
  SavedViewField,
  SavedViewFilterOperator,
  SavedViewKindContribution,
  ValidationResult,
  ViewDisplayOptions,
} from "./saved-view-types";

const emptyValueOperators = new Set<SavedViewFilterOperator>(["isEmpty", "isNotEmpty"]);

const isGroupFilter = (filter: FilterExpression): filter is { op: "and" | "or"; children: FilterExpression[] } =>
  "op" in filter;

const valid = { valid: true } as const satisfies ValidationResult;

export const validateSavedViewFilterAgainstFields = (
  filter: FilterExpression,
  fields: readonly SavedViewField[],
): ValidationResult => {
  if (isGroupFilter(filter)) {
    if (filter.children.length === 0) return { valid: false, reason: "Empty filter group" };
    for (const child of filter.children) {
      const result = validateSavedViewFilterAgainstFields(child, fields);
      if (!result.valid) return result;
    }
    return valid;
  }

  const field = fields.find((candidate) => candidate.id === filter.field);
  if (!field) return { valid: false, reason: `Unknown field: ${filter.field}` };
  if (!field.operators.includes(filter.operator)) {
    return { valid: false, reason: `Unsupported operator: ${filter.operator}` };
  }
  if (!emptyValueOperators.has(filter.operator) && !("value" in filter)) {
    return { valid: false, reason: "Filter value is required" };
  }
  return valid;
};

const collectDisplayFields = (display: ViewDisplayOptions) => [
  ...(display.columns ?? []),
  ...(display.sort?.map((sort) => sort.field) ?? []),
  ...(display.groupBy ?? []),
  ...(display.hiddenFields ?? []),
  ...(display.cardFields ?? []),
  ...(display.board?.columnField ? [display.board.columnField] : []),
];

export const validateSavedViewDisplay = (
  display: ViewDisplayOptions,
  kind: SavedViewKindContribution,
): ValidationResult => {
  if (!kind.layouts.includes(display.layout)) return { valid: false, reason: `Unsupported layout: ${display.layout}` };
  const fieldIds = new Set(kind.fields.map((field) => field.id));
  const unknownField = collectDisplayFields(display).find((field) => !fieldIds.has(field));
  if (unknownField) return { valid: false, reason: `Unknown display field: ${unknownField}` };
  return valid;
};
