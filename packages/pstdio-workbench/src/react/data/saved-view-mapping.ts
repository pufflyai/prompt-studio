import type { AttributeDescriptor, DataRendererFilterState, DataRendererSettings } from "@pstdio/ui";
import { MANUAL_ORDERING, NO_GROUPING, sanitizeFilters, sanitizeSettings } from "@pstdio/ui";
import type { FilterExpression, ViewDisplayOptions, WorkbenchSavedView } from "../../core";

export interface DataRendererViewSnapshot {
  filter: FilterExpression;
  display: ViewDisplayOptions;
}

export interface DataRendererStoreSnapshot {
  filters: DataRendererFilterState;
  settings: DataRendererSettings;
}

const isGroupFilter = (filter: FilterExpression): filter is { op: "and" | "or"; children: FilterExpression[] } =>
  "op" in filter;

const toPredicate = (field: string, values: string[]): FilterExpression => {
  if (values.length === 1) return { field, operator: "is", value: values[0] };
  return { field, operator: "in", value: values };
};

export const filtersToExpression = (filters: DataRendererFilterState): FilterExpression | undefined => {
  const predicates = Object.entries(filters)
    .filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].length > 0)
    .map(([field, values]) => toPredicate(field, values));

  if (predicates.length === 0) return undefined;
  if (predicates.length === 1) return predicates[0]!;
  return { op: "and", children: predicates };
};

const predicateToFilters = (filter: FilterExpression, filters: Record<string, string[]>) => {
  if (isGroupFilter(filter)) {
    for (const child of filter.children) predicateToFilters(child, filters);
    return;
  }

  const values = Array.isArray(filter.value) ? filter.value : [filter.value];
  const stringValues = values.filter((value): value is string => typeof value === "string");
  if (stringValues.length > 0) filters[filter.field] = stringValues;
};

export const expressionToFilters = (filter: FilterExpression): DataRendererFilterState => {
  const filters: Record<string, string[]> = {};
  predicateToFilters(filter, filters);
  return filters as DataRendererFilterState;
};

export const settingsToDisplay = (settings: DataRendererSettings): ViewDisplayOptions => ({
  layout: settings.viewMode,
  columns: settings.displayProperties,
  sort:
    settings.ordering.attributeId === MANUAL_ORDERING
      ? undefined
      : [{ field: settings.ordering.attributeId, direction: settings.ordering.direction }],
  groupBy: [settings.columnGrouping, settings.rowGrouping].filter((field) => field !== NO_GROUPING),
  density: "compact",
});

export const displayToSettings = (display: ViewDisplayOptions): DataRendererSettings => {
  const groupBy = display.groupBy ?? [];
  const sort = display.sort?.[0];

  return {
    viewMode: display.layout === "list" ? "list" : "board",
    columnGrouping: groupBy[0] ?? NO_GROUPING,
    rowGrouping: groupBy[1] ?? NO_GROUPING,
    ordering: {
      attributeId: sort?.field ?? MANUAL_ORDERING,
      direction: sort?.direction ?? "asc",
    },
    displayProperties: display.columns ?? [],
  };
};

export const storeToView = (
  state: DataRendererStoreSnapshot,
  fallbackFilter: FilterExpression,
): DataRendererViewSnapshot => ({
  filter: filtersToExpression(state.filters) ?? fallbackFilter,
  display: settingsToDisplay(state.settings),
});

/**
 * Convert a persisted saved view into store state. When the active contribution's
 * `attributes` list is supplied, unknown attribute ids in the view's filter or
 * grouping/ordering/display are silently dropped (and grouping/ordering fall
 * back to defaults). This keeps a stale view loadable even if the schema has
 * evolved.
 */
export const viewToStore = (
  view: DataRendererViewSnapshot | WorkbenchSavedView,
  attributes?: AttributeDescriptor[],
): DataRendererStoreSnapshot => {
  const filters = expressionToFilters(view.filter);
  const settings = displayToSettings(view.display);

  if (!attributes) return { filters, settings };
  return { filters: sanitizeFilters(filters, attributes), settings: sanitizeSettings(settings, attributes) };
};

export const savedViewEqualsSnapshot = (view: WorkbenchSavedView, snapshot: DataRendererViewSnapshot) =>
  JSON.stringify({ filter: view.filter, display: view.display }) === JSON.stringify(snapshot);
