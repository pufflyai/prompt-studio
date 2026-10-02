import { Icon as ChakraIcon, Flex, IconButton, Menu, Portal, Table, Text } from "@chakra-ui/react";
import type { ViewSortDirection } from "@pstdio/sdk/extensions";
import {
  type Cell,
  flexRender,
  type Header,
  type HeaderGroup,
  type Row,
  type Table as TanStackTable,
} from "@tanstack/react-table";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, ChevronsUpDown, EyeOff, ListFilter } from "lucide-react";
import { ResourceContextMenu } from "@/components/overlays/resource-context-menu";
import { Tooltip } from "@/components/primitives/tooltip";
import { ListRow } from "../list-row/list-row";
import type { DataTableColumnMeta } from "./data-table-column-meta";
import type { DataTableCellContext, DataTableProps, RowData } from "./types";

const utilityColumnIds = new Set(["rowIndex", "rowSelection", "rowActions"]);

/** The header field menu is a shortcut into the view: it never keeps a sort or filter of its own. */
export interface DataTableFieldMenu {
  sortFor: (columnId: string) => { direction: ViewSortDirection; level: number } | undefined;
  sortLevels: number;
  onSort: (columnId: string, direction: ViewSortDirection) => void;
  onFilterBy: (columnId: string) => void;
  onHide: (columnId: string) => void;
}

interface DataTableColumnHeaderProps {
  header: Header<RowData, unknown>;
  headerGroup: HeaderGroup<RowData>;
  table: TanStackTable<RowData>;
  fullWidth?: boolean;
  hasDescription?: boolean;
  fieldMenu?: DataTableFieldMenu;
}

const sortIcon = (direction: ViewSortDirection | undefined) => {
  if (direction === "asc") return ArrowUpNarrowWide;
  if (direction === "desc") return ArrowDownWideNarrow;
  return ChevronsUpDown;
};

interface FieldMenuItemProps {
  value: string;
  label: string;
  icon: typeof ListFilter;
  onActivate: () => void;
}

const FieldMenuItem = (props: FieldMenuItemProps) => (
  <Menu.Item value={props.value} asChild>
    <ListRow
      asChild
      variant="full-width"
      label={props.label}
      icon={<ChakraIcon as={props.icon} boxSize="16px" />}
      onActivate={props.onActivate}
    />
  </Menu.Item>
);

export const DataTableColumnHeader = (props: DataTableColumnHeaderProps) => {
  const { header, headerGroup, fullWidth, hasDescription, fieldMenu } = props;
  const columnId = header.column.id;
  const sort = fieldMenu?.sortFor(columnId);
  const showsFieldMenu = Boolean(fieldMenu) && !utilityColumnIds.has(columnId);
  const tooltipContent =
    columnId === "rowSelection" ? "Select all" : flexRender(header.column.columnDef.header, header.getContext());

  return (
    <Table.ColumnHeader
      data-column-id={columnId}
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
          {showsFieldMenu && fieldMenu ? (
            <Menu.Root>
              <Menu.Trigger asChild>
                <IconButton
                  ml="2px"
                  size="2xs"
                  minW="auto"
                  paddingX="2xs"
                  aria-label={sort ? `Sorted ${sort.direction}` : "Column options"}
                  variant="ghost"
                  color={sort ? "fg" : "fg.subtle"}
                >
                  <ChakraIcon as={sortIcon(sort?.direction)} boxSize="14px" />
                  {sort && fieldMenu.sortLevels > 1 ? (
                    <Text as="span" textStyle="label/XS" color="fg.muted">
                      {sort.level}
                    </Text>
                  ) : null}
                </IconButton>
              </Menu.Trigger>
              <Portal>
                <Menu.Positioner>
                  <Menu.Content zIndex="popover" bg="bg">
                    <FieldMenuItem
                      value="sort-asc"
                      label="Sort ascending"
                      icon={ArrowUpNarrowWide}
                      onActivate={() => fieldMenu.onSort(columnId, "asc")}
                    />
                    <FieldMenuItem
                      value="sort-desc"
                      label="Sort descending"
                      icon={ArrowDownWideNarrow}
                      onActivate={() => fieldMenu.onSort(columnId, "desc")}
                    />
                    <Menu.Separator />
                    <FieldMenuItem
                      value="filter"
                      label="Filter by this field"
                      icon={ListFilter}
                      onActivate={() => fieldMenu.onFilterBy(columnId)}
                    />
                    <FieldMenuItem
                      value="hide"
                      label="Hide column"
                      icon={EyeOff}
                      onActivate={() => fieldMenu.onHide(columnId)}
                    />
                  </Menu.Content>
                </Menu.Positioner>
              </Portal>
            </Menu.Root>
          ) : null}
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
  wrapRows: boolean;
  getCellContextMenuActions?: DataTableProps["getCellContextMenuActions"];
}

const DataTableCellView = (props: DataTableCellViewProps) => {
  const { cell, row, wrapRows, getCellContextMenuActions } = props;
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
      overflowWrap={wrapRows ? "anywhere" : undefined}
      padding="xs"
      height={wrapRows ? undefined : "10"}
      maxHeight={wrapRows ? undefined : "10"}
      borderRight="1px solid"
      borderColor="border.subtle"
      _last={{ borderRight: "none" }}
      borderBottom="none"
      key={cell.id}
      textStyle="paragraph/S/regular"
      textOverflow={wrapRows ? undefined : "ellipsis"}
      verticalAlign={wrapRows ? "top" : "middle"}
      whiteSpace={wrapRows ? "normal" : "nowrap"}
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
  wrapRows: boolean;
  onRowClick?: DataTableProps["onRowClick"];
  getCellContextMenuActions?: DataTableProps["getCellContextMenuActions"];
}

export const DataTableBodyRow = (props: DataTableBodyRowProps) => {
  const {
    row,
    noBorder,
    rowIsInteractive,
    rowIsActive,
    rowIsSelected,
    wrapRows,
    onRowClick,
    getCellContextMenuActions,
  } = props;

  return (
    <Table.Row
      key={row.id}
      data-active={rowIsActive ? "true" : undefined}
      data-selected={rowIsSelected ? "true" : undefined}
      aria-selected={rowIsSelected ? "true" : undefined}
      height={wrapRows ? undefined : "10"}
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
        <DataTableCellView
          key={cell.id}
          cell={cell}
          row={row}
          wrapRows={wrapRows}
          getCellContextMenuActions={getCellContextMenuActions}
        />
      ))}
    </Table.Row>
  );
};
