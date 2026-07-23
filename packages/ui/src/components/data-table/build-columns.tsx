import { Icon as ChakraIcon, chakra, IconButton, Menu, Portal, Text } from "@chakra-ui/react";
import type { CellContext, HeaderContext, RowSelectionState } from "@tanstack/react-table";
import { Check, ChevronDown, CircleHelp, Minus } from "lucide-react";
import { type CSSProperties, cloneElement, isValidElement, type ReactNode } from "react";

import { Checkbox } from "@/components/primitives/checkbox";
import { Tooltip } from "@/components/primitives/tooltip";
import { ListRow } from "../list-row/list-row";
import { CategoricalColorCell, resolveCategoricalColor } from "./categorical-color-cell";
import { resolveColorCellStyle } from "./color-cell-style";
import { ColorScaleCell, resolveColorScaleValue } from "./color-scale-cell";
import { columnHelper, formatDisplayValue, getIcon, isDisplayValue } from "./helpers";
import { JsonCell } from "./json-cell";
import type { DataTableColumnRenderer, DataTableRowAction, RowData } from "./types";

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
  columnDescriptions?: Partial<Record<string, string>>;
  compactHeaders?: Partial<Record<string, string>>;
  enableSelection?: boolean;
  rowActions?: DataTableRowAction[];
  selectedRowIds?: RowSelectionState;
  columnRenderers?: Partial<Record<string, DataTableColumnRenderer>>;
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
      aria-label="Select all"
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
          <ChakraIcon as={ChevronDown} boxSize="14px" />
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

interface FormattedCellProps {
  value: unknown;
}

const FormattedCell = (props: FormattedCellProps) => {
  const { value } = props;
  const displayValue = formatDisplayValue(value);

  if (isValidElement(displayValue)) {
    return (
      <chakra.span display="inline-flex" maxWidth="full" minW="0" overflow="hidden" whiteSpace="nowrap">
        {toSingleLineElement(displayValue)}
      </chakra.span>
    );
  }

  return (
    <Text maxWidth="full" overflow="hidden" textOverflow="ellipsis" textStyle="paragraph/S/regular" whiteSpace="nowrap">
      {displayValue}
    </Text>
  );
};

interface DataCellProps {
  columnLabel: string;
  renderer?: DataTableColumnRenderer;
  value: unknown;
}

const DataCell = (props: DataCellProps) => {
  const { columnLabel, renderer, value } = props;

  if (renderer?.type === "json") return <JsonCell columnLabel={columnLabel} value={value} />;

  if (renderer?.type === "color-scale") {
    const color = resolveColorScaleValue(value, renderer.stops);
    if (color && typeof value === "number") return <ColorScaleCell value={value} />;
  }

  if (renderer?.type === "categorical-color") {
    const color = resolveCategoricalColor(value, renderer.categories);
    if (color) {
      return (
        <CategoricalColorCell>
          <FormattedCell value={value} />
        </CategoricalColorCell>
      );
    }
  }

  return <FormattedCell value={value} />;
};

const resolveDataCellStyle = (value: unknown, renderer?: DataTableColumnRenderer) => {
  if (renderer?.type === "color-scale") {
    const color = resolveColorScaleValue(value, renderer.stops);
    if (color && typeof value === "number") return resolveColorCellStyle(color);
  }

  if (renderer?.type === "categorical-color") {
    const color = resolveCategoricalColor(value, renderer.categories);
    if (color) return resolveColorCellStyle(color);
  }
};

export function buildColumns(data: RowData[], columnKeys: string[], options: BuildColumnsOptions = {}) {
  const {
    columnIcons,
    columnDescriptions,
    compactHeaders,
    enableSelection = false,
    rowActions = [],
    selectedRowIds,
    columnRenderers,
  } = options;
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
    const renderer = columnRenderers?.[fallBackKey];
    const customIcon = columnIcons?.[fallBackKey];
    const headerIcon = customIcon === undefined ? getIcon(columnValues) : customIcon;
    const columnDescription = columnDescriptions?.[fallBackKey];

    return columnHelper.accessor((row) => row[fallBackKey], {
      id: fallBackKey,
      header: () => {
        const headerLabel = compactHeaders?.[fallBackKey] ?? fallBackKey;
        return (
          <chakra.span display="inline-flex" alignItems="center" gap="4px" minW="0" maxW="full" overflow="hidden">
            {headerIcon}
            <chakra.span overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
              {headerLabel}
            </chakra.span>
            {columnDescription ? (
              <Tooltip content={columnDescription}>
                <ChakraIcon
                  as={CircleHelp}
                  aria-label={`About ${headerLabel}`}
                  boxSize="12px"
                  color="fg.muted"
                  cursor="help"
                  flexShrink={0}
                  opacity={0.6}
                  tabIndex={0}
                />
              </Tooltip>
            ) : null}
          </chakra.span>
        );
      },
      cell: (info) => <DataCell columnLabel={fallBackKey} renderer={renderer} value={info.getValue()} />,
      meta: {
        getCellStyle: (value: unknown) => resolveDataCellStyle(value, renderer),
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
