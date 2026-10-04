import { DEFAULT_DATA_TABLE_SETTINGS } from "@pstdio/sdk/extensions";
import { useDeferredValue, useState } from "react";
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
  const { data, hiddenColumns, getRowId, compactHeaders, columnRenderers, columnTypes, groupableColumns } = props;
  const permanentlyHidden = new Set(hiddenColumns ?? []);
  const baseColumnKeys = Object.keys(data[0] || {}).filter((key) => !permanentlyHidden.has(key));
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
  const [search, setSearch] = useState("");
  // Typing stays responsive on large tables; the narrowed rows follow a frame later.
  const deferredSearch = useDeferredValue(search);

  const orderedColumnKeys = resolveDataTableColumnOrder(baseColumnKeys, settings.columnOrder);
  const visibleColumnKeys = orderedColumnKeys.filter((key) => !settings.hiddenColumns.includes(key));
  const attributes = buildDataTableRendererAttributes(data, orderedColumnKeys, {
    compactHeaders,
    columnRenderers,
    columnTypes,
    groupableColumns,
  });
  const rows = buildDataTableRendererRows(data, orderedColumnKeys, getRowId, columnRenderers);
  const filteredRows = filterRowsByView(rows, filter, attributes);
  const sortedRows = sortRowsByView(filteredRows, sorts, attributes);
  // Hidden columns keep their rules but are not searched: search matches only what the view shows.
  const shownRows = searchRows(sortedRows, deferredSearch, (row) =>
    visibleColumnKeys.flatMap((key) => dataTableCellText(row.sourceRow[key], columnRenderers?.[key])),
  );
  const groupField = findField(attributes, settings.grouping);
  const groups = groupField?.groupable
    ? groupRowsByField(
        shownRows,
        groupField,
        groupRowsByField(rows, groupField).map((group) => group.key),
      )
    : undefined;

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
    shownRows,
    groups,
    orderedColumnKeys,
    visibleColumnKeys,
  };
};
