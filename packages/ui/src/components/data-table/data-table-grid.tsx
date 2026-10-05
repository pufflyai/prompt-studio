import { Box, Table } from "@chakra-ui/react";
import type { Table as TanStackTable } from "@tanstack/react-table";
import { Fragment, lazy, Suspense } from "react";
import { ScrollArea } from "@/components/primitives/scroll-area";
import { DataTableGroupRow } from "./data-table-group-row";
import type { DataTablePageEntry } from "./data-table-grouping";
import type { DataTableRendererRow } from "./data-table-state";
import { getSelectedOriginalRows, shouldHighlightActiveRow } from "./data-table-state";
import { DataTableBodyRow, DataTableColumnHeader, type DataTableFieldMenu } from "./data-table-table-parts";
import { SelectionToolbar } from "./selection-toolbar";
import type { DataTableProps, DataTableSelectionAction, DataTableSettings, RowData } from "./types";

const DataTableStatsRow = lazy(() =>
  import("./data-table-stats-row").then((module) => ({ default: module.DataTableStatsRow })),
);

export interface DataTableGridProps
  extends Pick<
    DataTableProps,
    | "noBorder"
    | "fullWidth"
    | "onRowClick"
    | "isRowInteractive"
    | "activeRowId"
    | "columnDescriptions"
    | "columnStats"
    | "enableRowActivation"
    | "getCellContextMenuActions"
  > {
  table: TanStackTable<RowData>;
  /** The rows and group rows of the current page, in shown order. */
  entries: DataTablePageEntry<DataTableRendererRow>[];
  collapsed: Set<string>;
  onToggleGroup: (key: string) => void;
  settings: DataTableSettings;
  /** Every shown row, for the statistics row. */
  data: RowData[];
  fieldMenu: DataTableFieldMenu;
  /** Set when rows can be selected. */
  selectionActions?: DataTableSelectionAction[];
}

const resolveColumnSizeVars = (table: TanStackTable<RowData>) => {
  const colSizes: Record<string, number> = {};
  for (const header of table.getFlatHeaders()) {
    colSizes[`--header-${header.id}-size`] = header.getSize();
    colSizes[`--col-${header.column.id}-size`] = header.column.getSize();
  }
  return colSizes;
};

export const DataTableGrid = (props: DataTableGridProps) => {
  const { table, entries, collapsed, onToggleGroup, settings, data, fieldMenu, selectionActions } = props;
  const { noBorder, fullWidth, onRowClick, isRowInteractive, activeRowId, columnDescriptions, columnStats } = props;
  const { enableRowActivation = false, getCellContextMenuActions } = props;
  const tableRowsById = new Map(table.getRowModel().rows.map((row) => [row.id, row]));
  const columnSizeVars = resolveColumnSizeVars(table);
  const selectedRows = table.getSelectedRowModel().rows;

  return (
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
                      fieldMenu={fieldMenu}
                    />
                  ))}
                </Table.Row>
                {columnStats && settings.showStats ? (
                  <Suspense fallback={null}>
                    <DataTableStatsRow
                      headerGroup={headerGroup}
                      rows={data}
                      columnStats={columnStats}
                      noBorder={noBorder}
                      fullWidth={fullWidth}
                    />
                  </Suspense>
                ) : null}
              </Fragment>
            ))}
          </Table.Header>
          <Table.Body>
            {entries.map((entry) => {
              if (entry.kind === "group") {
                const { key } = entry.group;
                return (
                  <DataTableGroupRow
                    key={`group:${key}`}
                    label={entry.group.label}
                    count={entry.group.rows.length}
                    collapsed={collapsed.has(key)}
                    columnCount={table.getVisibleLeafColumns().length}
                    onToggle={() => onToggleGroup(key)}
                  />
                );
              }
              const row = tableRowsById.get(entry.row.id);
              if (!row) return null;
              return (
                <DataTableBodyRow
                  key={row.id}
                  row={row}
                  noBorder={noBorder}
                  rowIsInteractive={onRowClick ? (isRowInteractive?.(row.original) ?? true) : false}
                  rowIsActive={shouldHighlightActiveRow({ enableRowActivation, activeRowId, rowId: row.id })}
                  rowIsSelected={row.getIsSelected()}
                  wrapRows={settings.wrapRows}
                  onRowClick={onRowClick}
                  getCellContextMenuActions={getCellContextMenuActions}
                />
              );
            })}
          </Table.Body>
        </Table.Root>
      </ScrollArea>
      {selectionActions && selectedRows.length > 0 ? (
        <SelectionToolbar
          selectedCount={selectedRows.length}
          totalCount={data.length}
          onClearSelection={() => table.toggleAllRowsSelected(false)}
          onSelectAll={() => table.toggleAllRowsSelected(true)}
          actions={selectionActions}
          selectedRows={getSelectedOriginalRows(selectedRows)}
        />
      ) : null}
    </Box>
  );
};
