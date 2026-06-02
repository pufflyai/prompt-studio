import { Box, HStack } from "@chakra-ui/react";
import type { ReactNode } from "react";

import { countFilterValues } from "./data-renderer-grouping";
import {
  buildDisplayPropertyOptions,
  buildFilterCategories,
  buildGroupingOptions,
  buildOrderingOptions,
} from "./data-renderer-helpers";
import { DisplayMenu } from "./display-menu";
import { FilterMenu } from "./filter-menu";
import type { AttributeDescriptor, DataRendererFilterState, DataRendererRow, DataRendererSettings } from "./types";
import { useDataRendererStore } from "./use-data-renderer-store";
import { useResolvedAttributes } from "./use-resolved-attributes";

export interface DataRendererToolbarProps<TRow extends DataRendererRow = DataRendererRow> {
  rows: TRow[];
  storageKey: string;
  attributes: AttributeDescriptor[];
  defaultSettings?: Partial<DataRendererSettings>;
  defaultFilters?: DataRendererFilterState;
  leading?: ReactNode;
  align?: "split" | "end";
}

export const DataRendererToolbar = <TRow extends DataRendererRow>(props: DataRendererToolbarProps<TRow>) => {
  const {
    rows,
    storageKey,
    attributes: rawAttributes,
    defaultSettings,
    defaultFilters,
    leading,
    align = "split",
  } = props;

  const attributes = useResolvedAttributes(rawAttributes);
  const groupingOptions = buildGroupingOptions(attributes);
  const orderingOptions = buildOrderingOptions(attributes);
  const displayPropertyOptions = buildDisplayPropertyOptions(attributes);

  const initialState = { settings: defaultSettings, filters: defaultFilters };
  const settings = useDataRendererStore(storageKey, (state) => state.settings, initialState);
  const filters = useDataRendererStore(storageKey, (state) => state.filters, initialState);
  const setViewMode = useDataRendererStore(storageKey, (state) => state.setViewMode, initialState);
  const setColumnGrouping = useDataRendererStore(storageKey, (state) => state.setColumnGrouping, initialState);
  const setRowGrouping = useDataRendererStore(storageKey, (state) => state.setRowGrouping, initialState);
  const setOrderingAttributeId = useDataRendererStore(
    storageKey,
    (state) => state.setOrderingAttributeId,
    initialState,
  );
  const toggleSortDirection = useDataRendererStore(storageKey, (state) => state.toggleSortDirection, initialState);
  const toggleDisplayProperty = useDataRendererStore(storageKey, (state) => state.toggleDisplayProperty, initialState);
  const toggleFilterValue = useDataRendererStore(storageKey, (state) => state.toggleFilterValue, initialState);
  const clearFilter = useDataRendererStore(storageKey, (state) => state.clearFilter, initialState);
  const clearAllFilters = useDataRendererStore(storageKey, (state) => state.clearAllFilters, initialState);

  const categoryOptions = buildFilterCategories(attributes, rows);
  const countsByCategory = Object.fromEntries(
    categoryOptions.map((category) => [category.id, countFilterValues(rows, category.id, attributes)]),
  );

  return (
    <HStack
      gap="2xs"
      minW="0"
      w={align === "split" ? "full" : undefined}
      flexShrink={0}
      pb="sm"
      borderBottomWidth="1px"
      borderColor="border.muted"
    >
      {leading}
      {align === "split" ? <Box flex="1" /> : null}
      <FilterMenu
        categories={categoryOptions}
        filters={filters}
        countsByCategory={countsByCategory}
        onToggleFilterValue={toggleFilterValue}
        onClearFilter={clearFilter}
        onClearAll={clearAllFilters}
      />
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
    </HStack>
  );
};
