import "./data-table.css";

import { Box, Flex } from "@chakra-ui/react";
import { getCoreRowModel, type RowSelectionState, useReactTable } from "@tanstack/react-table";
import { useState } from "react";
import { CollectionViewEmptyState } from "../collection-view/collection-view-empty-state";
import { findField } from "../collection-view/collection-view-fields";
import { DisplaySortControl } from "../collection-view/display-sort-control";
import { buildColumns } from "./build-columns";
import { DataTableDisplayMenu } from "./data-table-display-menu";
import { DataTableGrid } from "./data-table-grid";
import { resolveCollapsedGroups, resolveTablePage } from "./data-table-grouping";
import { DataTableHeader } from "./data-table-header";
import { retainSelectedRows } from "./data-table-selection";
import {
  reorderDataTableColumns,
  resolveInitialPageSize,
  resolveSelectionActions,
  shouldEnableSelection,
  toggleHiddenDataTableColumn,
} from "./data-table-state";
import type { DataTableFieldMenu } from "./data-table-table-parts";
import { EditModeDataTable } from "./edit-mode-data-table";
import { PaginationFooter } from "./pagination-footer";
import type { DataTableProps } from "./types";
import { useDataTableView } from "./use-data-table-view";

const DatasetDataTable = (props: DataTableProps) => {
  const {
    noBorder,
    fullWidth,
    onRowClick,
    isRowInteractive,
    activeRowId,
    columnIcons,
    columnDescriptions,
    compactHeaders,
    columnStats,
    columnRenderers,
    initialPageSize,
    pageSizeOptions = [10, 20, 30, 50, 100],
    rowActions = [],
    getRowActions,
    enableRowActivation = false,
    getCellContextMenuActions,
  } = props;
  const view = useDataTableView(props);
  const { settings, setSettings, sorts, setSorts, filter, startRule } = view;
  // A different filter, sort, grouping, or search starts again on the first page.
  const pageKey = JSON.stringify([view.storageKey, filter, sorts, settings.grouping, view.deferredSearch]);
  const [pagePosition, setPagePosition] = useState({ key: pageKey, index: 0 });
  const localPageIndex = pagePosition.key === pageKey ? pagePosition.index : 0;
  const displayed = props.page?.displayed ?? props.page?.request;
  const pageIndex = displayed ? Math.floor(displayed.offset / displayed.limit) : localPageIndex;
  const setPageIndex = props.page?.onPageChange ?? ((index: number) => setPagePosition({ key: pageKey, index }));
  const [localPageSize, setLocalPageSize] = useState(() => resolveInitialPageSize({ initialPageSize }));
  const pageSize = displayed?.limit ?? localPageSize;
  const setPageSize = props.page?.onPageSizeChange ?? setLocalPageSize;
  const collapseKey = JSON.stringify([view.storageKey, settings.grouping]);
  const [collapse, setCollapse] = useState({ key: collapseKey, groups: [] as string[] });
  const collapsed = resolveCollapsedGroups(collapseKey, collapse, props.page?.request.collapsedGroups);
  const [selection, setSelection] = useState({
    key: pageKey,
    ids: {} as RowSelectionState,
    rows: new Map<string, Record<string, unknown>>(),
  });
  const rowSelection = selection.key === pageKey ? selection.ids : {};
  const enableSelection = shouldEnableSelection(props);
  const selectionActions = resolveSelectionActions(props);
  const { groups } = view;
  // Rows in collapsed groups leave the pages but still count for statistics, selection, and row numbers.
  const shownRows = groups ? groups.flatMap((group) => group.rows) : view.shownRows;
  const page = resolveTablePage({
    groups,
    rows: shownRows,
    collapsed,
    index: pageIndex,
    size: pageSize,
    provider: props.page?.result,
  });
  const data = shownRows.map((row) => row.sourceRow);
  const idBySource = new Map(shownRows.map((row) => [row.sourceRow, row.id]));
  const columns = buildColumns(data, view.visibleColumnKeys, {
    columnIcons,
    columnDescriptions,
    compactHeaders,
    enableSelection,
    rowActions,
    getRowActions,
    selectedRowIds: rowSelection,
    columnRenderers,
    wrapRows: settings.wrapRows,
    rowNumbers: settings.rowNumbers,
    rowOffset: displayed?.offset,
    search: view.deferredSearch,
  });

  const table = useReactTable({
    data,
    columns,
    defaultColumn: { size: 150, minSize: 40, maxSize: 800 },
    state: { rowSelection },
    getRowId: (row) => idBySource.get(row) ?? "",
    columnResizeMode: "onChange",
    columnResizeDirection: "ltr",
    onRowSelectionChange: (update) =>
      setSelection((previous) => {
        const ids = previous.key === pageKey ? previous.ids : {};
        const next = typeof update === "function" ? update(ids) : update;
        return {
          key: pageKey,
          ids: next,
          rows: retainSelectedRows(previous.rows, next, new Map(shownRows.map((row) => [row.id, row.sourceRow]))),
        };
      }),
    getCoreRowModel: getCoreRowModel(),
    enableMultiRowSelection: enableSelection,
    enableRowSelection: enableSelection,
    autoResetAll: false,
  });

  const fieldMenu: DataTableFieldMenu = {
    sortFor: (columnId) => {
      const sort = sorts[0];
      return sort?.attributeId === columnId ? sort.direction : undefined;
    },
    // Header and Display edit the same single ordering.
    onSort: (columnId, direction) => setSorts([{ attributeId: columnId, direction }]),
    onFilterBy: (columnId) => {
      const field = findField(view.attributes, columnId);
      if (field) startRule(field);
    },
    onHide: (columnId) =>
      setSettings({ hiddenColumns: toggleHiddenDataTableColumn(settings.hiddenColumns, columnId, false) }),
  };

  const total = props.page?.result?.total ?? view.rows.length;
  const nothingShown = total > 0 && view.shownRows.length === 0 && Boolean(view.deferredSearch.trim());

  return (
    <Flex
      aria-busy={props.page?.loading}
      direction="column"
      flex="1"
      minH="0"
      minW="0"
      height="100%"
      width="100%"
      overflow="hidden"
    >
      <DataTableHeader
        itemLabel={props.itemLabel}
        view={view}
        viewsSource={props.viewsSource}
        actions={props.toolbarActions}
        displayControl={
          <DataTableDisplayMenu
            columns={view.attributes}
            sortControl={<DisplaySortControl fields={view.attributes} sorts={sorts} onSortsChange={setSorts} />}
            settings={settings}
            statsAvailable={Boolean(columnStats)}
            onSettingsChange={setSettings}
            onColumnVisibilityChange={(columnId, visible) =>
              setSettings({ hiddenColumns: toggleHiddenDataTableColumn(settings.hiddenColumns, columnId, visible) })
            }
            onColumnReorder={(activeColumnId, overColumnId) =>
              setSettings({
                columnOrder: reorderDataTableColumns(view.orderedColumnKeys, activeColumnId, overColumnId),
              })
            }
          />
        }
      />
      {props.contentPlaceholder != null || nothingShown ? (
        <Box flex="1" minH="0" overflow="auto">
          {props.contentPlaceholder ?? (
            <CollectionViewEmptyState search={view.deferredSearch} onClearSearch={() => view.setSearch("")} />
          )}
        </Box>
      ) : (
        <DataTableGrid
          page={props.page}
          selectedRecords={
            props.page
              ? [
                  ...retainSelectedRows(
                    selection.rows,
                    rowSelection,
                    new Map(shownRows.map((row) => [row.id, row.sourceRow])),
                  ).values(),
                ]
              : undefined
          }
          table={table}
          entries={page.entries}
          collapsed={collapsed}
          onToggleGroup={(key) => {
            const next = new Set(collapsed);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            if (props.page) props.page.onCollapsedGroupsChange([...next]);
            else setCollapse({ key: collapseKey, groups: [...next] });
          }}
          settings={settings}
          data={data}
          fieldMenu={fieldMenu}
          selectionActions={enableSelection ? selectionActions : undefined}
          noBorder={noBorder}
          fullWidth={fullWidth}
          onRowClick={onRowClick}
          isRowInteractive={isRowInteractive}
          activeRowId={activeRowId}
          columnDescriptions={columnDescriptions}
          columnStats={columnStats}
          enableRowActivation={enableRowActivation}
          getCellContextMenuActions={getCellContextMenuActions}
        />
      )}
      {page.pageCount > 1 ? (
        <PaginationFooter
          pageCount={page.pageCount}
          navigationIndex={props.page ? Math.floor(props.page.request.offset / props.page.request.limit) : undefined}
          loading={props.page?.loading}
          pageIndex={page.page}
          pageSize={pageSize}
          pageSizeOptions={pageSizeOptions}
          onPageChange={setPageIndex}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPageIndex(0);
          }}
        />
      ) : null}
    </Flex>
  );
};

export const DataTable = (props: DataTableProps) => {
  if (props.editMode) return <EditModeDataTable {...props} />;
  return <DatasetDataTable {...props} />;
};
