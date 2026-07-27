import type { ReactNode } from "react";
import { DisplayMenu } from "./display-menu";
import { FilterMenu } from "./filter-menu";
import { countFilterValues } from "./kanban-renderer-grouping";
import {
  buildDisplayPropertyOptions,
  buildFilterCategories,
  buildGroupingOptions,
  buildOrderingOptions,
} from "./kanban-renderer-helpers";
import { KanbanRendererViewBar } from "./kanban-renderer-view-bar";
import type {
  AttributeDescriptor,
  KanbanRendererFilterState,
  KanbanRendererRow,
  KanbanRendererSavedView,
  KanbanRendererSettings,
} from "./types";
import { useKanbanRendererStore } from "./use-kanban-renderer-store";
import { useResolvedAttributes } from "./use-resolved-attributes";

export interface KanbanRendererToolbarProps<TRow extends KanbanRendererRow = KanbanRendererRow> {
  rows: TRow[];
  storageKey: string;
  attributes: AttributeDescriptor[];
  defaultSettings?: Partial<KanbanRendererSettings>;
  defaultFilters?: KanbanRendererFilterState;
  defaultViews?: KanbanRendererSavedView[];
  defaultActiveViewId?: string;
  leading?: ReactNode;
  displayControl?: ReactNode;
  align?: "split" | "end";
}

export const KanbanRendererToolbar = <TRow extends KanbanRendererRow>(props: KanbanRendererToolbarProps<TRow>) => {
  const {
    rows,
    storageKey,
    attributes: rawAttributes,
    defaultSettings,
    defaultFilters,
    defaultViews,
    defaultActiveViewId,
    leading,
    displayControl,
    align = "split",
  } = props;

  const attributes = useResolvedAttributes(rawAttributes);
  const groupingOptions = buildGroupingOptions(attributes);
  const orderingOptions = buildOrderingOptions(attributes);
  const displayPropertyOptions = buildDisplayPropertyOptions(attributes);

  const initialState = {
    settings: defaultSettings,
    filters: defaultFilters,
    views: defaultViews,
    activeViewId: defaultActiveViewId,
  };
  const settings = useKanbanRendererStore(storageKey, (state) => state.settings, initialState);
  const filters = useKanbanRendererStore(storageKey, (state) => state.filters, initialState);
  const setViewMode = useKanbanRendererStore(storageKey, (state) => state.setViewMode, initialState);
  const setColumnGrouping = useKanbanRendererStore(storageKey, (state) => state.setColumnGrouping, initialState);
  const setRowGrouping = useKanbanRendererStore(storageKey, (state) => state.setRowGrouping, initialState);
  const setOrderingAttributeId = useKanbanRendererStore(
    storageKey,
    (state) => state.setOrderingAttributeId,
    initialState,
  );
  const toggleSortDirection = useKanbanRendererStore(storageKey, (state) => state.toggleSortDirection, initialState);
  const toggleDisplayProperty = useKanbanRendererStore(
    storageKey,
    (state) => state.toggleDisplayProperty,
    initialState,
  );
  const toggleFilterValue = useKanbanRendererStore(storageKey, (state) => state.toggleFilterValue, initialState);
  const clearFilter = useKanbanRendererStore(storageKey, (state) => state.clearFilter, initialState);
  const clearAllFilters = useKanbanRendererStore(storageKey, (state) => state.clearAllFilters, initialState);

  const categoryOptions = buildFilterCategories(attributes, rows);
  const countsByCategory = Object.fromEntries(
    categoryOptions.map((category) => [category.id, countFilterValues(rows, category.id, attributes)]),
  );

  const filterControl = (
    <FilterMenu
      categories={categoryOptions}
      filters={filters}
      countsByCategory={countsByCategory}
      onToggleFilterValue={toggleFilterValue}
      onClearFilter={clearFilter}
      onClearAll={clearAllFilters}
    />
  );
  const resolvedDisplayControl =
    displayControl === undefined ? (
      <DisplayMenu
        settings={settings}
        groupingOptions={groupingOptions}
        orderingOptions={orderingOptions}
        displayPropertyOptions={displayPropertyOptions}
        onViewModeChange={setViewMode}
        onColumnGroupingChange={setColumnGrouping}
        onRowGroupingChange={setRowGrouping}
        onOrderingAttributeIdChange={setOrderingAttributeId}
        onSortDirectionToggle={toggleSortDirection}
        onDisplayPropertyToggle={toggleDisplayProperty}
      />
    ) : (
      displayControl
    );

  return (
    <KanbanRendererViewBar
      storageKey={storageKey}
      categories={categoryOptions}
      filters={filters}
      leading={leading}
      filterControl={filterControl}
      displayControl={resolvedDisplayControl}
      align={align}
    />
  );
};
