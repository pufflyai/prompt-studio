import "./data-table.css";

import { Icon as ChakraIcon, Flex, IconButton, Menu, Portal, Table, Text } from "@chakra-ui/react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDownAZ, ArrowUpAZ, MoreVertical } from "lucide-react";
import { useEffect, useState } from "react";

import { ListRow } from "../list-row/list-row";
import { ScrollArea } from "../scroll-area";
import { Tooltip } from "../tooltip";
import { buildColumns } from "./build-columns";
import { PaginationFooter } from "./pagination-footer";
import { SelectionToolbar } from "./selection-toolbar";
import type { DataTableProps } from "./types";

export const DataTable = (props: DataTableProps) => {
  const {
    data,
    noBorder,
    fullWidth,
    onCSVDownload,
    hiddenColumns,
    onRowClick,
    isRowInteractive,
    activeRowId,
    columnIcons,
  } = props;
  const [sorting, setSorting] = useState<SortingState>([]);
  const hiddenColumnsSet = new Set(hiddenColumns ?? []);
  const columnKeys = Object.keys(data[0] || {}).filter((key) => !hiddenColumnsSet.has(key));
  const columns = buildColumns(data, columnKeys, columnIcons);

  const table = useReactTable({
    data,
    columns,
    defaultColumn: { size: 150, minSize: 40, maxSize: 800 },
    state: { sorting },
    columnResizeMode: "onChange",
    columnResizeDirection: "ltr",
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableMultiRowSelection: true,
    enableRowSelection: true,
    autoResetAll: true,
  });

  useEffect(() => {
    table.setPageSize(30);
  }, [table]);

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
  const selectedRowIds = selectedRows
    .map((row) => row.original.id)
    .filter((id): id is string => typeof id === "string");

  return (
    <Flex direction="column" height="100%" width="100%">
      {!!selectedRows.length && (
        <SelectionToolbar
          selectedCount={selectedRows.length}
          totalCount={allRows.length}
          onClearSelection={() => table.toggleAllRowsSelected(false)}
          onSelectAll={() => table.toggleAllRowsSelected(true)}
          onCSVDownload={() => onCSVDownload?.(selectedRowIds)}
        />
      )}
      <ScrollArea height="100%" maxWidth="unset" showHorizontalScrollbar>
        <Table.Root
          className={`data-table${fullWidth ? " full-width" : ""}`}
          stickyHeader
          style={{ ...columnSizeVars, width: fullWidth ? "100%" : table.getTotalSize() }}
        >
          <Table.Header>
            {table.getHeaderGroups().map((headerGroup) => (
              <Table.Row
                background="bg.muted"
                key={headerGroup.id}
                borderRight={noBorder ? "none" : "1px solid"}
                borderColor="border.muted"
              >
                {headerGroup.headers.map((header) => (
                  <Table.ColumnHeader
                    textTransform="none"
                    borderRight="1px solid"
                    _last={{ borderRight: "none" }}
                    borderColor="border.muted"
                    paddingX="xs"
                    paddingY="2xs"
                    key={header.id}
                    overflow={"hidden"}
                    position="relative"
                    style={{
                      width:
                        fullWidth && headerGroup.headers.indexOf(header) === headerGroup.headers.length - 1
                          ? undefined
                          : `calc(var(--header-${header?.id}-size) * 1px)`,
                    }}
                  >
                    <Tooltip content={flexRender(header.column.columnDef.header, header.getContext())}>
                      <Flex
                        className="group"
                        alignItems="center"
                        justifyContent="space-between"
                        gap="1"
                        flex="1"
                        paddingY="2xs"
                      >
                        <Text textStyle="label/S/medium">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </Text>
                        {header.column.id !== "rowIndex" && table.getCoreRowModel().rows.length > 1 && (
                          <Menu.Root>
                            <Menu.Trigger asChild>
                              <IconButton
                                ml="2px"
                                size="2xs"
                                aria-label="sort column"
                                variant="ghost"
                                visibility="hidden"
                                _groupHover={{ visibility: "visible" }}
                              >
                                <ChakraIcon as={MoreVertical} boxSize="14px" />
                              </IconButton>
                            </Menu.Trigger>
                            <Portal>
                              <Menu.Positioner>
                                <Menu.Content zIndex="popover" bg="bg">
                                  <Menu.Item value="sort-asc" asChild>
                                    <ListRow
                                      asChild
                                      variant="compact"
                                      label="Sort ascending"
                                      icon={<ChakraIcon as={ArrowUpAZ} boxSize="16px" />}
                                      disabled={header.column.getIsSorted() === "asc"}
                                      onActivate={() => header.column.toggleSorting(false)}
                                    />
                                  </Menu.Item>
                                  <Menu.Item value="sort-desc" asChild>
                                    <ListRow
                                      asChild
                                      variant="compact"
                                      label="Sort descending"
                                      icon={<ChakraIcon as={ArrowDownAZ} boxSize="16px" />}
                                      disabled={header.column.getIsSorted() === "desc"}
                                      onActivate={() => header.column.toggleSorting(true)}
                                    />
                                  </Menu.Item>
                                  {header.column.getIsSorted() && (
                                    <Menu.Item value="clear-sort" asChild>
                                      <ListRow
                                        asChild
                                        variant="compact"
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
                ))}
              </Table.Row>
            ))}
          </Table.Header>
          <Table.Body>
            {table.getRowModel().rows.map((row) => {
              const rowIsInteractive = onRowClick ? (isRowInteractive?.(row.original) ?? true) : false;

              return (
                <Table.Row
                  key={row.id}
                  cursor={rowIsInteractive ? "pointer" : undefined}
                  onClick={rowIsInteractive ? () => onRowClick?.(row.original) : undefined}
                  borderTop={noBorder ? "none" : "1px solid"}
                  borderBottom={"1px solid"}
                  borderRight={noBorder ? "none" : "1px solid"}
                  _last={{ borderBottom: noBorder ? "none" : "1px solid", borderColor: "border.muted" }}
                  borderColor="border.muted"
                  background={
                    activeRowId && typeof row.original.id === "string" && row.original.id === activeRowId
                      ? "bg.panel"
                      : "bg"
                  }
                  _hover={rowIsInteractive ? { background: "bg.panel" } : undefined}
                >
                  {row.getVisibleCells().map((cell, index) => (
                    <Table.Cell
                      width="fit-content"
                      maxWidth={"12rem"}
                      overflow={"hidden"}
                      padding="xs"
                      borderRight="1px solid"
                      borderColor="border.muted"
                      _last={{ borderRight: "none" }}
                      borderBottom="none"
                      key={cell.id}
                      textStyle="paragraph/S/regular"
                      background={index === 0 ? "bg.muted" : "inherit"}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </Table.Cell>
                  ))}
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table.Root>
      </ScrollArea>
      {table.getPageCount() > 1 && <PaginationFooter table={table} />}
    </Flex>
  );
};
