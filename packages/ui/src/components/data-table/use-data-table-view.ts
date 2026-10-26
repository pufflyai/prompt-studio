import { DEFAULT_DATA_TABLE_SETTINGS } from "@pstdio/sdk/extensions";
import { useDeferredValue, useState } from "react";
import { applyPageGroupCounts } from "../collection-view/collection-page";
import { findField } from "../collection-view/collection-view-fields";
import { filterRowsByView } from "../collection-view/collection-view-filter";
import { groupRowsByField } from "../collection-view/collection-view-grouping";
import { searchRows } from "../collection-view/collection-view-search";
import { sortRowsByView } from "../collection-view/collection-view-sort";
import { type CollectionViewStoreState, useCollectionViewStore } from "../collection-view/use-collection-view-store";
import { useCollectionViews } from "../collection-view/use-collection-views";
import {
  buildDataTableRendererAttributes,
  buildDataTableRendererRows,
  dataTableCellText,
  resolveDataTableColumnOrder,
  resolveDataTableToolbarStorageKey,
} from "./data-table-state";
import type { DataTableProps, DataTableSettings } from "./types";

type DataTableViewDefaults = Pick<DataTableProps, "defaultSettings" | "defaultFilter" | "defaultSorts">;

export const dataTableInitialState = (defaults: DataTableViewDefaults) => ({
  settings: { ...DEFAULT_DATA_TABLE_SETTINGS, ...defaults.defaultSettings } as DataTableSettings,
  filter: defaults.defaultFilter,
  sorts: defaults.defaultSorts,
});

/** The unsaved view state of one table. Hosts read it to send the view to their query. */
export const useDataTableViewStore = <T>(
  storageKey: string,
  selector: (state: CollectionViewStoreState<DataTableSettings>) => T,
  defaults: DataTableViewDefaults = {},
) => useCollectionViewStore(storageKey, dataTableInitialState(defaults), selector);

/**
 * Runs a table's view: the saved or edited filter, sorts, and display settings, plus the search
 * typed on screen. Order is decided here, so the table itself never sorts.
 */
export const useDataTableView = (props: DataTableProps) => {
  const {
    data,
    hiddenColumns,
    getRowId,
    compactHeaders,
    columnRenderers,
    columnTypes,
    groupableColumns,
    filterableColumns,
  } = props;
  const permanentlyHidden = new Set(hiddenColumns ?? []);
  const baseColumnKeys = Object.keys(data[0] || props.columnTypes || props.compactHeaders || {}).filter(
    (key) => !permanentlyHidden.has(key),
  );
  const storageKey = resolveDataTableToolbarStorageKey({
    toolbarStorageKey: props.toolbarStorageKey,
    columnKeys: baseColumnKeys,
  });
  const initialState = dataTableInitialState(props);
  const views = useCollectionViews({
    storageKey,
    initialState,
    viewsSource: props.viewsSource,
    defaultViews: props.defaultViews,
    defaultActiveViewId: props.defaultActiveViewId,
  });
  const store = useCollectionViewStore(storageKey, initialState, (state) => state);
  const { settings, filter, sorts } = store;
  const [localSearch, setLocalSearch] = useState("");
  const search = props.page?.request.search ?? localSearch;
  const setSearch = props.page?.onSearchChange ?? setLocalSearch;
  // Typing stays responsive on large tables; the narrowed rows follow a frame later.
  const deferredSearch = useDeferredValue(search);

  const orderedColumnKeys = resolveDataTableColumnOrder(baseColumnKeys, settings.columnOrder);
  const visibleColumnKeys = orderedColumnKeys.filter((key) => !settings.hiddenColumns.includes(key));
  const attributes = buildDataTableRendererAttributes(data, orderedColumnKeys, {
    compactHeaders,
    columnRenderers,
    columnTypes,
    groupableColumns,
    filterableColumns,
  });
  const rows = buildDataTableRendererRows(data, orderedColumnKeys, getRowId, columnRenderers);
  const filteredRows = props.page ? rows : filterRowsByView(rows, filter, attributes);
  const sortedRows = props.page ? filteredRows : sortRowsByView(filteredRows, sorts, attributes);
  // Hidden columns keep their rules but are not searched: search matches only what the view shows.
  const shownRows = props.page
    ? sortedRows
    : searchRows(sortedRows, deferredSearch, (row) =>
        visibleColumnKeys.flatMap((key) => dataTableCellText(row.sourceRow[key], columnRenderers?.[key])),
      );
  const groupField = findField(attributes, settings.grouping);
  const localGroups = groupField?.groupable
    ? groupRowsByField(
        shownRows,
        groupField,
        groupRowsByField(rows, groupField).map((group) => group.key),
      )
    : undefined;
  const groups =
    localGroups && groupField && props.page?.result
      ? applyPageGroupCounts(localGroups, props.page.result.groups, groupField)
      : localGroups;

  return {
    ...store,
    storageKey,
    initialState,
    views,
    search,
    deferredSearch,
    setSearch,
    attributes,
    rows,
    filteredRows,
    totalCount: props.page?.result?.total ?? filteredRows.length,
    shownCount: props.page?.result?.filteredTotal ?? shownRows.length,
    shownRows,
    groups,
    orderedColumnKeys,
    visibleColumnKeys,
  };
};
