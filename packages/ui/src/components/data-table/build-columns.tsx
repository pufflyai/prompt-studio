import { Icon as ChakraIcon, chakra, IconButton, Menu, Portal, Text } from "@chakra-ui/react";
import type { CellContext, HeaderContext, RowSelectionState } from "@tanstack/react-table";
import { Check, EllipsisVertical, Minus } from "lucide-react";
import { type CSSProperties, cloneElement, isValidElement, type ReactNode } from "react";

import { Checkbox } from "@/components/primitives/checkbox";
import { ListRow } from "../list-row/list-row";
import { columnHelper, formatDisplayValue, getIcon, isDisplayValue } from "./helpers";
import type { DataTableRowAction, RowData } from "./types";

const getSortValue = (value: unknown) => {
  return isDisplayValue(value) ? value.sortValue : value;
};

const compareValues = (valueA: unknown, valueB: unknown) => {
  if (valueA === valueB) return 0;
  if (valueA === null || valueA === undefined) return 1;
  if (valueB === null || valueB === undefined) return -1;

  if (typeof valueA === "number" && typeof valueB === "number") {
    return valueA - valueB;
  }

  return String(valueA).localeCompare(String(valueB));
};

const toSingleLineElement = (element: ReactNode) => {
  if (!isValidElement<{ style?: CSSProperties }>(element)) return element;

  return cloneElement(element, {
    style: {
      ...element.props.style,
      flexWrap: "nowrap",
      minWidth: 0,
      whiteSpace: "nowrap",
    },
  });
};

interface BuildColumnsOptions {
  columnIcons?: Partial<Record<string, ReactNode>>;
  compactHeaders?: Partial<Record<string, string>>;
  enableSelection?: boolean;
  rowActions?: DataTableRowAction[];
  selectedRowIds?: RowSelectionState;
}

const stopControlPropagation = (event: { stopPropagation: () => void }) => {
  event.stopPropagation();
};

const SelectionHeader = (props: HeaderContext<RowData, unknown>) => {
  const { table } = props;
  const checked = table.getIsAllRowsSelected();
  const isIndeterminate = !checked && table.getIsSomeRowsSelected();

  return (
    <Checkbox
      checked={checked ? true : isIndeterminate ? "indeterminate" : false}
      aria-label="Select all rows"
      icon={<ChakraIcon as={isIndeterminate ? Minus : Check} boxSize="12px" strokeWidth="3" />}
      onClick={stopControlPropagation}
      onCheckedChange={(details) => table.toggleAllRowsSelected(details.checked === true)}
    />
  );
};

const SelectionCell = (props: CellContext<RowData, unknown> & { selectedRowIds?: RowSelectionState }) => {
  const { row, selectedRowIds } = props;

  return (
    <Checkbox
      checked={Boolean(selectedRowIds?.[row.id])}
      aria-label="Select row"
      icon={<ChakraIcon as={Check} boxSize="12px" strokeWidth="3" />}
      onClick={stopControlPropagation}
      onCheckedChange={(details) => row.toggleSelected(details.checked === true)}
    />
  );
};

const RowActionsCell = (props: CellContext<RowData, unknown> & { actions: DataTableRowAction[] }) => {
  const { row, actions } = props;

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <IconButton aria-label="Row actions" size="2xs" variant="ghost" onClick={stopControlPropagation}>
          <ChakraIcon as={EllipsisVertical} boxSize="14px" />
        </IconButton>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content zIndex="popover" bg="bg">
            {actions.map((action) => (
              <Menu.Item key={action.label} value={action.label} asChild>
                <ListRow
                  asChild
                  variant="full-width"
                  tone={action.destructive ? "danger" : "default"}
                  label={action.label}
                  icon={action.icon}
                  onClick={stopControlPropagation}
                  onActivate={() => action.onSelect(row.original)}
                />
              </Menu.Item>
            ))}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};

export function buildColumns(data: RowData[], columnKeys: string[], options: BuildColumnsOptions = {}) {
  const { columnIcons, compactHeaders, enableSelection = false, rowActions = [], selectedRowIds } = options;
  const rowIndexColumn = columnHelper.accessor((_row, rowIndex) => rowIndex + 1, {
    header: "",
    id: "rowIndex",
    enableResizing: false,
    size: 20,
    cell: (info) => (
      <chakra.span display={"block"} textStyle={"paragraph/S/regular"} textAlign={"center"}>
        {info.getValue()}
      </chakra.span>
    ),
  });

  const selectionColumn = columnHelper.display({
    id: "rowSelection",
    header: SelectionHeader,
    cell: (info) => <SelectionCell {...info} selectedRowIds={selectedRowIds} />,
    enableResizing: false,
    enableSorting: false,
    size: 36,
  });

  const dataColumns = columnKeys.map((key) => {
    const fallBackKey = key || "-";
    const columnValues = data.map((row) => row[fallBackKey]);
    const customIcon = columnIcons?.[fallBackKey];
    const headerIcon = customIcon === undefined ? getIcon(columnValues) : customIcon;

    return columnHelper.accessor((row) => row[fallBackKey], {
      id: fallBackKey,
      header: () => {
        const headerLabel = compactHeaders?.[fallBackKey] ?? fallBackKey;
        if (!headerIcon) return headerLabel;
        return (
          <chakra.span display="inline-flex" alignItems="center" gap="4px" minW="0" maxW="full" overflow="hidden">
            {headerIcon}
            <chakra.span overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
              {headerLabel}
            </chakra.span>
          </chakra.span>
        );
      },
      cell: (info) => {
        const value = info.getValue();
        const displayValue = formatDisplayValue(value);
        if (isValidElement(displayValue)) {
          return (
            <chakra.span display="inline-flex" maxWidth="full" minW="0" overflow="hidden" whiteSpace="nowrap">
              {toSingleLineElement(displayValue)}
            </chakra.span>
          );
        }
        return (
          <Text
            maxWidth="full"
            overflow="hidden"
            textOverflow="ellipsis"
            textStyle="paragraph/S/regular"
            whiteSpace="nowrap"
          >
            {displayValue}
          </Text>
        );
      },
      sortingFn: (rowA, rowB) => {
        const valueA = getSortValue(rowA.original[fallBackKey]);
        const valueB = getSortValue(rowB.original[fallBackKey]);
        return compareValues(valueA, valueB);
      },
    });
  });

  const rowActionsColumn = columnHelper.display({
    id: "rowActions",
    header: "",
    cell: (info) => <RowActionsCell {...info} actions={rowActions} />,
    enableResizing: false,
    enableSorting: false,
    size: 36,
  });

  return [
    rowIndexColumn,
    ...(enableSelection ? [selectionColumn] : []),
    ...dataColumns,
    ...(rowActions.length > 0 ? [rowActionsColumn] : []),
  ];
}
