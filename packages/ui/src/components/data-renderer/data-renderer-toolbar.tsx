import { Box, HStack } from "@chakra-ui/react";
import type { ReactNode } from "react";

import { countFilterValues } from "./data-renderer-grouping";
import { buildDefaultFilterCategories, buildTagOptions } from "./data-renderer-helpers";
import { DisplayMenu } from "./display-menu";
import { FilterMenu } from "./filter-menu";
import {
  type DataRendererFilterCategory,
  type DataRendererFilterState,
  type DataRendererOption,
  type DataRendererRow,
  type DataRendererSettings,
  type DataRendererTagDefinition,
  DEFAULT_DISPLAY_PROPERTY_OPTIONS,
  DEFAULT_GROUPING_OPTIONS,
  DEFAULT_ORDERING_OPTIONS,
  type DisplayProperty,
  type GroupingField,
  type OrderingField,
} from "./types";
import { useDataRendererStore } from "./use-data-renderer-store";

export interface DataRendererToolbarProps<TTicket extends DataRendererRow = DataRendererRow> {
  tickets: TTicket[];
  storageKey: string;
  tagDefinitions?: DataRendererTagDefinition[];
  groupingOptions?: DataRendererOption<GroupingField>[];
  orderingOptions?: DataRendererOption<OrderingField>[];
  displayPropertyOptions?: DataRendererOption<DisplayProperty>[];
  filterCategories?: DataRendererFilterCategory[];
  defaultSettings?: Partial<DataRendererSettings>;
  defaultFilters?: DataRendererFilterState;
  leading?: ReactNode;
  align?: "split" | "end";
}

export const DataRendererToolbar = <TTicket extends DataRendererRow>(props: DataRendererToolbarProps<TTicket>) => {
  const {
    tickets,
    storageKey,
    tagDefinitions = [],
    groupingOptions: groupingOptionsProp,
    orderingOptions: orderingOptionsProp,
    displayPropertyOptions: displayPropertyOptionsProp,
    filterCategories,
    defaultSettings,
    defaultFilters,
    leading,
    align = "split",
  } = props;

  const tagOptions = buildTagOptions(tagDefinitions);
  const groupingOptions = groupingOptionsProp ?? [...DEFAULT_GROUPING_OPTIONS, ...tagOptions.grouping];
  const orderingOptions = orderingOptionsProp ?? [...DEFAULT_ORDERING_OPTIONS, ...tagOptions.ordering];
  const displayPropertyOptions = displayPropertyOptionsProp ?? [
    ...DEFAULT_DISPLAY_PROPERTY_OPTIONS,
    ...tagOptions.display,
  ];

  const initialState = { settings: defaultSettings, filters: defaultFilters };
  const settings = useDataRendererStore(storageKey, (state) => state.settings, initialState);
  const filters = useDataRendererStore(storageKey, (state) => state.filters, initialState);
  const setViewMode = useDataRendererStore(storageKey, (state) => state.setViewMode, initialState);
  const setColumnGrouping = useDataRendererStore(storageKey, (state) => state.setColumnGrouping, initialState);
  const setRowGrouping = useDataRendererStore(storageKey, (state) => state.setRowGrouping, initialState);
  const setOrderingField = useDataRendererStore(storageKey, (state) => state.setOrderingField, initialState);
  const toggleSortDirection = useDataRendererStore(storageKey, (state) => state.toggleSortDirection, initialState);
  const toggleDisplayProperty = useDataRendererStore(storageKey, (state) => state.toggleDisplayProperty, initialState);
  const toggleFilterValue = useDataRendererStore(storageKey, (state) => state.toggleFilterValue, initialState);
  const clearFilter = useDataRendererStore(storageKey, (state) => state.clearFilter, initialState);
  const clearAllFilters = useDataRendererStore(storageKey, (state) => state.clearAllFilters, initialState);

  const categoryOptions = filterCategories ?? buildDefaultFilterCategories(tickets, tagDefinitions);
  const countsByCategory = Object.fromEntries(
    categoryOptions.map((category) => [category.id, countFilterValues(tickets, category.id)]),
  );

  return (
    <HStack gap="2xs" minW="0" w={align === "split" ? "full" : undefined} flexShrink={0}>
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
        onOrderingFieldChange={setOrderingField}
        onSortDirectionToggle={toggleSortDirection}
        onDisplayPropertyToggle={toggleDisplayProperty}
      />
    </HStack>
  );
};
