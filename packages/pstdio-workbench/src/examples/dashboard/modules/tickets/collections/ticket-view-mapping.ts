import type { DataRendererFilterState, DataRendererSettings, FilterCategory } from "@pstdio/ui";
import type { FilterExpression, ViewDisplayOptions } from "../../../../../core";
import { dashboardStatusColumns } from "../../../shared/mock-data/tickets";

const statusValues = dashboardStatusColumns.map((column) => column.id);

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
