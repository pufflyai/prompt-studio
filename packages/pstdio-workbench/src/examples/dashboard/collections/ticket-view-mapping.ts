import type {
  DataRendererFilterState,
  DataRendererSettings,
  DisplayProperty,
  FilterCategory,
  GroupingField,
  OrderingField,
} from "@pstdio/ui";
import type { FilterExpression, ViewDisplayOptions, WorkbenchSavedView } from "../../../core";
import { dashboardStatusColumns } from "../mock-data/data";

export interface TicketViewSnapshot {
  filter: FilterExpression;
  display: ViewDisplayOptions;
}

interface DataRendererSnapshot {
  filters: DataRendererFilterState;
  settings: DataRendererSettings;
}

const statusValues = dashboardStatusColumns.map((column) => column.id);

const isGroupFilter = (filter: FilterExpression): filter is { op: "and" | "or"; children: FilterExpression[] } =>
  "op" in filter;

const defaultFilter = (): FilterExpression => ({ field: "status", operator: "in", value: statusValues });

const toPredicate = (field: string, values: string[]): FilterExpression => {
  if (values.length === 1) return { field, operator: "is", value: values[0] };
  return { field, operator: "in", value: values };
};

export const filtersToExpression = (filters: DataRendererFilterState): FilterExpression => {
  const predicates = Object.entries(filters)
    .filter((entry): entry is [FilterCategory, string[]] => Array.isArray(entry[1]) && entry[1].length > 0)
    .map(([field, values]) => toPredicate(field, values));

  if (predicates.length === 0) return defaultFilter();
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
  if (filter.field === "status" && stringValues.length === statusValues.length) return;
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

export const ticketStoreToView = (state: DataRendererSnapshot): TicketViewSnapshot => ({
  filter: filtersToExpression(state.filters),
  display: settingsToDisplay(state.settings),
});

export const ticketViewToStore = (view: TicketViewSnapshot | WorkbenchSavedView) => ({
  filters: expressionToFilters(view.filter),
  settings: displayToSettings(view.display),
});

export const savedViewEqualsSnapshot = (view: WorkbenchSavedView, snapshot: TicketViewSnapshot) =>
  JSON.stringify({ filter: view.filter, display: view.display }) === JSON.stringify(snapshot);
