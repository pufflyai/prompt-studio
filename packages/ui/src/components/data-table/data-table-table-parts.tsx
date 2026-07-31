import { Icon as ChakraIcon, Flex, IconButton, Menu, Portal, Table, Text } from "@chakra-ui/react";
import {
  type Cell,
  flexRender,
  type Header,
  type HeaderGroup,
  type Row,
  type Table as TanStackTable,
} from "@tanstack/react-table";
import { ArrowDownAZ, ArrowUpAZ, MoreVertical } from "lucide-react";
import type { CSSProperties } from "react";
import { ResourceContextMenu } from "@/components/overlays/resource-context-menu";
import { Tooltip } from "@/components/primitives/tooltip";
import { ListRow } from "../list-row/list-row";
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
  hasDescription?: boolean;
}

export const DataTableColumnHeader = (props: DataTableColumnHeaderProps) => {
  const { header, headerGroup, table, fullWidth, hasDescription } = props;
  const sortDirection = header.column.getIsSorted();
  const canSortColumn = !utilityColumnIds.has(header.column.id) && table.getCoreRowModel().rows.length > 1;
  const SortIcon = getSortMenuIcon(sortDirection);
  const tooltipContent =
    header.column.id === "rowSelection"
      ? "Select all"
      : flexRender(header.column.columnDef.header, header.getContext());

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
      overflow="hidden"
      position="relative"
      verticalAlign="middle"
      whiteSpace="nowrap"
      style={{
        width:
          fullWidth && headerGroup.headers.indexOf(header) === headerGroup.headers.length - 1
            ? undefined
            : `calc(var(--header-${header.id}-size) * 1px)`,
      }}
    >
      <Tooltip content={tooltipContent} disabled={hasDescription}>
        <Flex className="group" alignItems="center" justifyContent="space-between" gap="1" flex="1" minW="0">
          <Text as="div" textStyle="label/S/medium" lineHeight="1.2" truncate>
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

interface DataTableColumnMeta {
  getCellStyle?: (value: unknown) => CSSProperties | undefined;
}

const DataTableCellView = (props: DataTableCellViewProps) => {
  const { cell, row, getCellContextMenuActions } = props;
  const columnMeta = cell.column.columnDef.meta as DataTableColumnMeta | undefined;
  const cellStyle = columnMeta?.getCellStyle?.(cell.getValue());
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
      maxWidth="12rem"
      overflow="hidden"
      padding="xs"
      borderRight="1px solid"
      borderColor="border.subtle"
      _last={{ borderRight: "none" }}
      borderBottom="none"
      key={cell.id}
      textStyle="paragraph/S/regular"
      textOverflow="ellipsis"
      whiteSpace="nowrap"
      style={cellStyle}
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

export const DataTableBodyRow = (props: DataTableBodyRowProps) => {
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
      borderBottom="1px solid"
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
