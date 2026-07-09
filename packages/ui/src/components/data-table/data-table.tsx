import "./data-table.css";

import { Icon as ChakraIcon, Flex, IconButton, Menu, Portal, Table, Text } from "@chakra-ui/react";
import {
  type Cell,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type Header,
  type HeaderGroup,
  type PaginationState,
  type Row,
  type RowSelectionState,
  type SortingState,
  type Table as TanStackTable,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDownAZ, ArrowUpAZ, MoreVertical } from "lucide-react";
import { useEffect, useState } from "react";
import { ResourceContextMenu } from "@/components/overlays/resource-context-menu";
import { ScrollArea } from "@/components/primitives/scroll-area";
import { Tooltip } from "@/components/primitives/tooltip";
import { useDataRendererStore } from "../data-renderer/use-data-renderer-store";
import { ListRow } from "../list-row/list-row";
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
import { PaginationFooter } from "./pagination-footer";
import type { DataTableCellContext, DataTableProps, RowData } from "./types";

const utilityColumnIds = new Set(["rowIndex", "rowSelection", "rowActions"]);

const getSortMenuIcon = (sortDirection: false | "asc" | "desc") => {
  if (sortDirection === "asc") return ArrowUpAZ;
  if (sortDirection === "desc") return ArrowDownAZ;
  return MoreVertical;
};

interface DataTableColumnHeaderProps {
  header: Header<RowData, unknown>;
  headerGroup: HeaderGroup<RowData>;
  table: TanStackTable<RowData>;
  fullWidth?: boolean;
}

const DataTableColumnHeader = (props: DataTableColumnHeaderProps) => {
  const { header, headerGroup, table, fullWidth } = props;
  const sortDirection = header.column.getIsSorted();
  const canSortColumn = !utilityColumnIds.has(header.column.id) && table.getCoreRowModel().rows.length > 1;
  const SortIcon = getSortMenuIcon(sortDirection);

  return (
    <Table.ColumnHeader
      data-column-id={header.column.id}
      textTransform="none"
      borderRight="1px solid"
      _last={{ borderRight: "none" }}
      borderColor="border.subtle"
      paddingX="xs"
      paddingY="xs"
      key={header.id}
      overflow={"hidden"}
      position="relative"
      verticalAlign="middle"
      whiteSpace="nowrap"
      style={{
        width:
          fullWidth && headerGroup.headers.indexOf(header) === headerGroup.headers.length - 1
            ? undefined
            : `calc(var(--header-${header?.id}-size) * 1px)`,
      }}
    >
      <Tooltip content={flexRender(header.column.columnDef.header, header.getContext())}>
        <Flex className="group" alignItems="center" justifyContent="space-between" gap="1" flex="1" minW="0">
          <Text textStyle="label/S/medium" lineHeight="1.2" truncate>
            {flexRender(header.column.columnDef.header, header.getContext())}
          </Text>
          {canSortColumn && (
            <Menu.Root>
              <Menu.Trigger asChild>
                <IconButton
                  ml="2px"
                  size="2xs"
                  aria-label={sortDirection ? `Sorted ${sortDirection}` : "Sort column"}
                  variant="ghost"
                  visibility={sortDirection ? "visible" : "hidden"}
                  _groupHover={{ visibility: "visible" }}
                >
                  <ChakraIcon as={SortIcon} boxSize="14px" />
                </IconButton>
              </Menu.Trigger>
              <Portal>
                <Menu.Positioner>
                  <Menu.Content zIndex="popover" bg="bg">
                    <Menu.Item value="sort-asc" asChild>
                      <ListRow
                        asChild
                        variant="full-width"
                        label="Sort ascending"
                        icon={<ChakraIcon as={ArrowUpAZ} boxSize="16px" />}
                        disabled={sortDirection === "asc"}
                        onActivate={() => header.column.toggleSorting(false)}
                      />
                    </Menu.Item>
                    <Menu.Item value="sort-desc" asChild>
                      <ListRow
                        asChild
                        variant="full-width"
                        label="Sort descending"
                        icon={<ChakraIcon as={ArrowDownAZ} boxSize="16px" />}
                        disabled={sortDirection === "desc"}
                        onActivate={() => header.column.toggleSorting(true)}
                      />
                    </Menu.Item>
                    {sortDirection && (
                      <Menu.Item value="clear-sort" asChild>
                        <ListRow
                          asChild
                          variant="full-width"
                          label="Clear sort"
                          onActivate={() => header.column.clearSorting()}
                        />
                      </Menu.Item>
                    )}
                  </Menu.Content>
                </Menu.Positioner>
              </Portal>
            </Menu.Root>
          )}
          {header.column.getCanResize() && (
            <span
              {...{
                onDoubleClick: () => header.column.resetSize(),
                onMouseDown: header.getResizeHandler(),
                onTouchStart: header.getResizeHandler(),
                className: `resizer ${header.column.getIsResizing() ? "isResizing" : ""}`,
              }}
            />
          )}
        </Flex>
      </Tooltip>
    </Table.ColumnHeader>
  );
};

interface DataTableCellViewProps {
  cell: Cell<RowData, unknown>;
  row: Row<RowData>;
  getCellContextMenuActions?: DataTableProps["getCellContextMenuActions"];
}

const DataTableCellView = (props: DataTableCellViewProps) => {
  const { cell, row, getCellContextMenuActions } = props;
  const cellContext: DataTableCellContext = {
    row: row.original,
    rowId: row.id,
    columnId: cell.column.id,
    value: cell.getValue(),
  };
  const contextActions =
    getCellContextMenuActions?.(cellContext).map((action) => ({
      key: action.label,
      label: action.label,
      icon: action.icon,
      onClick: () => action.onSelect(cellContext),
    })) ?? [];
  const cellElement = (
    <Table.Cell
      data-column-id={cell.column.id}
      width="fit-content"
      maxWidth={"12rem"}
      overflow={"hidden"}
      padding="xs"
      borderRight="1px solid"
      borderColor="border.subtle"
      _last={{ borderRight: "none" }}
      borderBottom="none"
      key={cell.id}
      textStyle="paragraph/S/regular"
      textOverflow="ellipsis"
      whiteSpace="nowrap"
    >
      {flexRender(cell.column.columnDef.cell, cell.getContext())}
    </Table.Cell>
  );

  if (contextActions.length === 0) return cellElement;

  return (
    <ResourceContextMenu key={cell.id} actions={contextActions}>
      {cellElement}
    </ResourceContextMenu>
  );
};

interface DataTableBodyRowProps {
  row: Row<RowData>;
  noBorder?: boolean;
  rowIsInteractive: boolean;
  rowIsActive: boolean;
  rowIsSelected: boolean;
  onRowClick?: DataTableProps["onRowClick"];
  getCellContextMenuActions?: DataTableProps["getCellContextMenuActions"];
}

const DataTableBodyRow = (props: DataTableBodyRowProps) => {
  const { row, noBorder, rowIsInteractive, rowIsActive, rowIsSelected, onRowClick, getCellContextMenuActions } = props;

  return (
    <Table.Row
      key={row.id}
      data-active={rowIsActive ? "true" : undefined}
      data-selected={rowIsSelected ? "true" : undefined}
      aria-selected={rowIsSelected ? "true" : undefined}
      cursor={rowIsInteractive ? "pointer" : undefined}
      onClick={rowIsInteractive ? () => onRowClick?.(row.original) : undefined}
      borderTop={noBorder ? "none" : "1px solid"}
      borderBottom={"1px solid"}
      borderRight={noBorder ? "none" : "1px solid"}
      _last={{ borderBottom: noBorder ? "none" : "1px solid", borderColor: "border.subtle" }}
      borderColor="border.subtle"
      background={rowIsActive ? "bg.active" : "bg"}
    >
      {row.getVisibleCells().map((cell) => (
        <DataTableCellView key={cell.id} cell={cell} row={row} getCellContextMenuActions={getCellContextMenuActions} />
      ))}
    </Table.Row>
  );
};

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
    compactHeaders,
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
  const filters = useDataRendererStore(resolvedToolbarStorageKey, (state) => state.filters, {
    settings: { viewMode: "list" },
  });
  const filteredRendererRows = filterDataTableRows(rendererRows, filters, rendererAttributes);
  const filteredData = filteredRendererRows.map((row) => row.sourceRow);
  const columns = buildColumns(data, columnKeys, {
    columnIcons,
    compactHeaders,
    enableSelection,
    rowActions,
    selectedRowIds: rowSelection,
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
      onColumnToggle={(columnId) =>
        setHiddenColumnMenuIds((current) => {
          const next = new Set(current);
          if (next.has(columnId)) {
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
    />
  );

  return (
    <Flex direction="column" height="100%" width="100%">
      <DataTableHeader
        rows={rendererRows}
        storageKey={resolvedToolbarStorageKey}
        attributes={rendererAttributes}
        selectedCount={enableSelection ? selectedRows.length : 0}
        totalCount={allRows.length}
        visibleCount={filteredData.length}
        onClearSelection={() => table.toggleAllRowsSelected(false)}
        onSelectAll={() => table.toggleAllRowsSelected(true)}
        actions={selectionActions}
        selectedRows={selectedOriginalRows}
        columnControl={columnControl}
      />
      <ScrollArea height="100%" maxWidth="unset" showHorizontalScrollbar>
        <Table.Root
          className={`data-table${fullWidth ? " full-width" : ""}`}
          stickyHeader
          style={{ ...columnSizeVars, width: fullWidth ? "100%" : table.getTotalSize() }}
        >
          <Table.Header>
            {table.getHeaderGroups().map((headerGroup) => (
              <Table.Row key={headerGroup.id} borderRight={noBorder ? "none" : "1px solid"} borderColor="border.subtle">
                {headerGroup.headers.map((header) => (
                  <DataTableColumnHeader
                    key={header.id}
                    header={header}
                    headerGroup={headerGroup}
                    table={table}
                    fullWidth={fullWidth}
                  />
                ))}
              </Table.Row>
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
