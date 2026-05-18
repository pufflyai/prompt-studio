import type {
  DataRendererFilterState,
  DataRendererSettings,
  DisplayProperty,
  FilterCategory,
  GroupingField,
  OrderingField,
} from "@pstdio/ui";
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
    .filter((entry): entry is [FilterCategory, string[]] => Array.isArray(entry[1]) && entry[1].length > 0)
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
    settings.ordering.field === "manual"
      ? undefined
      : [{ field: settings.ordering.field, direction: settings.ordering.direction }],
  groupBy: [settings.columnGrouping, settings.rowGrouping].filter((field) => field !== "none"),
  density: "compact",
});

export const displayToSettings = (display: ViewDisplayOptions): DataRendererSettings => {
  const groupBy = display.groupBy ?? [];
  const sort = display.sort?.[0];

  return {
    viewMode: display.layout === "list" ? "list" : "board",
    columnGrouping: (groupBy[0] ?? "status") as GroupingField,
    rowGrouping: (groupBy[1] ?? "none") as GroupingField,
    ordering: {
      field: (sort?.field ?? "manual") as OrderingField,
      direction: sort?.direction ?? "asc",
    },
    displayProperties: (display.columns ?? []) as DisplayProperty[],
  };
};

export const storeToView = (
  state: DataRendererStoreSnapshot,
  fallbackFilter: FilterExpression,
): DataRendererViewSnapshot => ({
  filter: filtersToExpression(state.filters) ?? fallbackFilter,
  display: settingsToDisplay(state.settings),
});

export const viewToStore = (view: DataRendererViewSnapshot | WorkbenchSavedView): DataRendererStoreSnapshot => ({
  filters: expressionToFilters(view.filter),
  settings: displayToSettings(view.display),
});

export const savedViewEqualsSnapshot = (view: WorkbenchSavedView, snapshot: DataRendererViewSnapshot) =>
  JSON.stringify({ filter: view.filter, display: view.display }) === JSON.stringify(snapshot);
