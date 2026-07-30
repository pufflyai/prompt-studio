import "./data-table.css";

import { Box, Flex, Table } from "@chakra-ui/react";
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { Fragment, useEffect, useState } from "react";
import { ScrollArea } from "@/components/primitives/scroll-area";
import { useKanbanRendererStore } from "../kanban-renderer/use-kanban-renderer-store";
import { buildColumns } from "./build-columns";
import { DataTableColumnMenu } from "./data-table-column-menu";
import { DataTableHeader } from "./data-table-header";
import {
  buildDataTableRendererAttributes,
  buildDataTableRendererRows,
  filterDataTableRows,
  getSelectedOriginalRows,
  reorderDataTableColumns,
  resolveDataTableColumnOrder,
  resolveDataTableRowId,
  resolveDataTableToolbarStorageKey,
  resolveInitialPageSize,
  resolveSelectionActions,
  shouldEnableSelection,
  shouldHighlightActiveRow,
} from "./data-table-state";
import { DataTableStatsRow } from "./data-table-stats-row";
import { DataTableBodyRow, DataTableColumnHeader } from "./data-table-table-parts";
import { PaginationFooter } from "./pagination-footer";
import { SelectionToolbar } from "./selection-toolbar";
import type { DataTableProps } from "./types";

export const DataTable = (props: DataTableProps) => {
  const {
    data,
    noBorder,
    fullWidth,
    hiddenColumns,
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
    getRowId,
    toolbarStorageKey,
    enableRowActivation = false,
    getCellContextMenuActions,
  } = props;
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>(() => ({
    pageIndex: 0,
    pageSize: resolveInitialPageSize({ initialPageSize }),
  }));
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [showStats, setShowStats] = useState(true);
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    const propHiddenColumnsSet = new Set(hiddenColumns ?? []);
    return Object.keys(data[0] || {}).filter((key) => !propHiddenColumnsSet.has(key));
  });
  const [hiddenColumnMenuIds, setHiddenColumnMenuIds] = useState<Set<string>>(() => new Set());
  const hiddenColumnsSet = new Set(hiddenColumns ?? []);
  const baseColumnKeys = Object.keys(data[0] || {}).filter((key) => !hiddenColumnsSet.has(key));
  const orderedBaseColumnKeys = resolveDataTableColumnOrder(baseColumnKeys, columnOrder);
  const visibleColumnIds = new Set(orderedBaseColumnKeys.filter((key) => !hiddenColumnMenuIds.has(key)));
  const columnKeys = orderedBaseColumnKeys.filter((key) => visibleColumnIds.has(key));
  const enableSelection = shouldEnableSelection(props);
  const selectionActions = resolveSelectionActions(props);
  const rendererAttributes = buildDataTableRendererAttributes(data, orderedBaseColumnKeys, compactHeaders);
  const rendererRows = buildDataTableRendererRows(data, orderedBaseColumnKeys, getRowId);
  const resolvedToolbarStorageKey = resolveDataTableToolbarStorageKey({
    toolbarStorageKey,
    columnKeys: baseColumnKeys,
  });
  const filters = useKanbanRendererStore(resolvedToolbarStorageKey, (state) => state.filters, {
    settings: { viewMode: "list" },
  });
  const filteredRendererRows = filterDataTableRows(rendererRows, filters, rendererAttributes);
  const filteredData = filteredRendererRows.map((row) => row.sourceRow);
  const columns = buildColumns(data, columnKeys, {
    columnIcons,
    columnDescriptions,
    compactHeaders,
    enableSelection,
    rowActions,
    selectedRowIds: rowSelection,
    columnRenderers,
  });

  const table = useReactTable({
    data: filteredData,
    columns,
    defaultColumn: { size: 150, minSize: 40, maxSize: 800 },
    state: { sorting, pagination, rowSelection },
    getRowId: (row, index) => resolveDataTableRowId(row, index, getRowId),
    columnResizeMode: "onChange",
    columnResizeDirection: "ltr",
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    getSortedRowModel: getSortedRowModel(),
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableMultiRowSelection: enableSelection,
    enableRowSelection: enableSelection,
    autoResetAll: false,
  });

  useEffect(() => {
    const pageCount = table.getPageCount();
    if (pageCount === 0 || pagination.pageIndex < pageCount) return;

    setPagination((current) => ({
      ...current,
      pageIndex: Math.max(pageCount - 1, 0),
    }));
  }, [pagination.pageIndex, table]);

  const columnSizeVars = (() => {
    const headers = table.getFlatHeaders();
    const colSizes: Record<string, number> = {};
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i]!;
      colSizes[`--header-${header.id}-size`] = header.getSize();
      colSizes[`--col-${header.column.id}-size`] = header.column.getSize();
    }
    return colSizes;
  })();

  const selectedRows = table.getSelectedRowModel().rows;
  const allRows = table.getCoreRowModel().rows;
  const selectedOriginalRows = getSelectedOriginalRows(selectedRows);
  const columnControl = (
    <DataTableColumnMenu
      columns={orderedBaseColumnKeys.map((columnId) => ({
        id: columnId,
        label: compactHeaders?.[columnId] ?? columnId,
      }))}
      visibleColumnIds={visibleColumnIds}
      showStats={showStats}
      statsAvailable={Boolean(columnStats)}
      onColumnVisibilityChange={(columnId, visible) =>
        setHiddenColumnMenuIds((current) => {
          const next = new Set(current);
          if (visible) {
            next.delete(columnId);
          } else {
            next.add(columnId);
          }
          return next;
        })
      }
      onColumnReorder={(activeColumnId, overColumnId) =>
        setColumnOrder((current) =>
          reorderDataTableColumns(resolveDataTableColumnOrder(baseColumnKeys, current), activeColumnId, overColumnId),
        )
      }
      onStatsVisibilityChange={setShowStats}
    />
  );

  return (
    <Flex direction="column" height="100%" width="100%">
      <DataTableHeader
        rows={rendererRows}
        storageKey={resolvedToolbarStorageKey}
        attributes={rendererAttributes}
        columnControl={columnControl}
      />
      <Box position="relative" flex="1" minHeight="0">
        <ScrollArea height="100%" maxWidth="unset" showHorizontalScrollbar>
          <Table.Root
            className={`data-table${fullWidth ? " full-width" : ""}`}
            style={{ ...columnSizeVars, width: fullWidth ? "100%" : table.getTotalSize() }}
          >
            <Table.Header>
              {table.getHeaderGroups().map((headerGroup) => (
                <Fragment key={headerGroup.id}>
                  <Table.Row
                    className="data-table-column-header-row"
                    borderRight={noBorder ? "none" : "1px solid"}
                    borderColor="border.subtle"
                  >
                    {headerGroup.headers.map((header) => (
                      <DataTableColumnHeader
                        key={header.id}
                        header={header}
                        headerGroup={headerGroup}
                        table={table}
                        fullWidth={fullWidth}
                        hasDescription={Boolean(columnDescriptions?.[header.column.id])}
                      />
                    ))}
                  </Table.Row>
                  {columnStats && showStats ? (
                    <DataTableStatsRow
                      headerGroup={headerGroup}
                      rows={filteredData}
                      columnStats={columnStats}
                      noBorder={noBorder}
                      fullWidth={fullWidth}
                    />
                  ) : null}
                </Fragment>
              ))}
            </Table.Header>
            <Table.Body>
              {table.getRowModel().rows.map((row) => {
                const rowIsInteractive = onRowClick ? (isRowInteractive?.(row.original) ?? true) : false;
                const rowIsActive = shouldHighlightActiveRow({ enableRowActivation, activeRowId, rowId: row.id });
                const rowIsSelected = row.getIsSelected();

                return (
                  <DataTableBodyRow
                    key={row.id}
                    row={row}
                    noBorder={noBorder}
                    rowIsInteractive={rowIsInteractive}
                    rowIsActive={rowIsActive}
                    rowIsSelected={rowIsSelected}
                    onRowClick={onRowClick}
                    getCellContextMenuActions={getCellContextMenuActions}
                  />
                );
              })}
            </Table.Body>
          </Table.Root>
        </ScrollArea>
        {enableSelection && selectedRows.length > 0 ? (
          <SelectionToolbar
            selectedCount={selectedRows.length}
            totalCount={allRows.length}
            onClearSelection={() => table.toggleAllRowsSelected(false)}
            onSelectAll={() => table.toggleAllRowsSelected(true)}
            actions={selectionActions}
            selectedRows={selectedOriginalRows}
          />
        ) : null}
      </Box>
      {table.getPageCount() > 1 && (
        <PaginationFooter
          table={table}
          pageIndex={pagination.pageIndex}
          pageSize={pagination.pageSize}
          pageSizeOptions={pageSizeOptions}
        />
      )}
    </Flex>
  );
};
