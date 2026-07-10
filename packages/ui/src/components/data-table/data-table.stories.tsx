import { Box, Button, Icon as ChakraIcon, HStack, Input, Stack, Text } from "@chakra-ui/react";
import {
  Archive,
  Building2,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  DollarSign,
  Factory,
  FileText,
  Flame,
  Globe2,
  Info,
  Pencil,
  Trash2,
} from "lucide-react";
import { type ReactNode, useState } from "react";

import { DataTable, type DataTableProps, type RowData } from ".";
import { columnDescriptions } from "./data-table.story-descriptions";
import { columnManagementRows, generateTableRows, tableRows, thousandTableRows } from "./data-table.story-fixtures";

type StoryFn = () => ReactNode;

interface StoryContext {
  parameters?: {
    pageHeight?: string;
    pagePadding?: string | number;
  };
}

interface DataTableStoryContainerProps {
  args: DataTableProps;
  height?: string;
  marginX?: string;
  maxWidth?: string;
}

const columnIconProps = {
  boxSize: "14px",
};

const columnIcons: DataTableProps["columnIcons"] = {
  Invoice: <ChakraIcon as={FileText} {...columnIconProps} />,
  Vendor: <ChakraIcon as={Factory} {...columnIconProps} />,
  "Due Date": <ChakraIcon as={CalendarClock} {...columnIconProps} />,
  Amount: <ChakraIcon as={DollarSign} {...columnIconProps} />,
  Approved: <ChakraIcon as={CheckCircle2} {...columnIconProps} />,
  Status: <ChakraIcon as={Info} {...columnIconProps} />,
  Region: <ChakraIcon as={Globe2} {...columnIconProps} />,
  Department: <ChakraIcon as={Building2} {...columnIconProps} />,
  Priority: <ChakraIcon as={Flame} {...columnIconProps} />,
  "Payment Method": <ChakraIcon as={CreditCard} {...columnIconProps} />,
};

const compactHeaders: DataTableProps["compactHeaders"] = {
  Invoice: "Inv",
  Vendor: "Vendor",
  "Due Date": "Due",
  "Payment Method": "Pay",
};

const selectionActions: DataTableProps["selectionActions"] = [
  {
    label: "Archive",
    icon: <ChakraIcon as={Archive} boxSize="16px" />,
    onSelect: (rows) => console.log("Archive rows", rows),
  },
  {
    label: "Delete",
    destructive: true,
    icon: <ChakraIcon as={Trash2} boxSize="16px" />,
    onSelect: (rows) => console.log("Delete rows", rows),
  },
];

const rowActions: DataTableProps["rowActions"] = [
  {
    label: "Archive invoice",
    icon: <ChakraIcon as={Archive} boxSize="16px" />,
    onSelect: (row) => console.log("Archive invoice", row),
  },
  {
    label: "Delete invoice",
    destructive: true,
    icon: <ChakraIcon as={Trash2} boxSize="16px" />,
    onSelect: (row) => console.log("Delete invoice", row),
  },
];

const withStoryPage = (Story: StoryFn, context: StoryContext) => {
  const pagePadding = context.parameters?.pagePadding ?? "sm";
  const pageHeight = context.parameters?.pageHeight;

  return (
    <Box padding={pagePadding} background="bg" height={pageHeight}>
      <Story />
    </Box>
  );
};

const DataTableStoryContainer = (props: DataTableStoryContainerProps) => {
  const { args, maxWidth, height, marginX } = props;
  const [activeRowId, setActiveRowId] = useState<string | null>(null);

  const handleRowClick = (row: RowData) => {
    if (!args.enableRowActivation) return;

    const rowId = row.id;

    if (typeof rowId !== "string") return;

    setActiveRowId(rowId);
  };

  return (
    <Box width="100%" maxWidth={maxWidth} height={height} marginX={marginX}>
      <DataTable {...args} activeRowId={activeRowId} onRowClick={handleRowClick} />
    </Box>
  );
};

const EditableCellsRenderer = (props: DataTableStoryContainerProps) => {
  const { args, maxWidth, height, marginX } = props;
  const [rows, setRows] = useState(() => generateTableRows(18));
  const [editingCell, setEditingCell] = useState<{
    rowId: string;
    columnId: string;
    value: string;
  } | null>(null);

  const editableColumns = new Set(["Vendor", "Amount", "Region", "Department", "Priority"]);

  const handleSave = () => {
    if (!editingCell) return;

    setRows((currentRows) =>
      currentRows.map((row) => {
        if (row.id !== editingCell.rowId) return row;
        const nextValue = editingCell.columnId === "Amount" ? Number(editingCell.value) : editingCell.value;
        return { ...row, [editingCell.columnId]: nextValue };
      }),
    );
    setEditingCell(null);
  };

  return (
    <Stack width="100%" maxWidth={maxWidth} height={height} marginX={marginX} gap="xs">
      <Box flex="1" minH="0">
        <DataTable
          {...args}
          data={rows}
          getCellContextMenuActions={(context) => {
            if (!editableColumns.has(context.columnId)) return [];

            return [
              {
                label: "Edit cell",
                icon: <ChakraIcon as={Pencil} boxSize="16px" />,
                onSelect: () =>
                  setEditingCell({
                    rowId: context.rowId,
                    columnId: context.columnId,
                    value: String(context.value ?? ""),
                  }),
              },
            ];
          }}
        />
      </Box>
      {editingCell ? (
        <HStack gap="xs" borderWidth="1px" borderColor="border.subtle" padding="xs" borderRadius="xs">
          <Text textStyle="label/S/medium" color="fg.muted">
            {editingCell.columnId}
          </Text>
          <Input
            size="sm"
            value={editingCell.value}
            onChange={(event) => setEditingCell({ ...editingCell, value: event.target.value })}
          />
          <Button size="sm" onClick={handleSave}>
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditingCell(null)}>
            Cancel
          </Button>
        </HStack>
      ) : null}
    </Stack>
  );
};

const meta = {
  title: "Components/Data Display/Data Table",
  component: DataTable,
  decorators: [withStoryPage],
  args: {
    data: tableRows,
    hiddenColumns: ["id"],
    columnIcons,
    toolbarStorageKey: "storybook-data-table-default",
  },
};

export default meta;

export const Default = {
  render: (args: DataTableProps) => {
    return <DataTableStoryContainer args={args} maxWidth="960px" height="420px" marginX="auto" />;
  },
};

export const ColumnStats = {
  args: {
    data: generateTableRows(96),
    initialPageSize: 50,
    columnStats: {
      Invoice: { type: "unique" },
      Amount: { type: "histogram", bins: 12 },
      Status: { type: "top-values", limit: 2 },
      Region: { type: "top-values", limit: 2 },
    },
    toolbarStorageKey: "storybook-data-table-column-stats",
  },
  render: (args: DataTableProps) => {
    return <DataTableStoryContainer args={args} maxWidth="1180px" height="560px" marginX="auto" />;
  },
};

export const ColumnDescriptions = {
  args: {
    data: generateTableRows(24),
    columnDescriptions,
    toolbarStorageKey: "storybook-data-table-column-descriptions",
  },
  render: (args: DataTableProps) => (
    <DataTableStoryContainer args={args} maxWidth="1080px" height="480px" marginX="auto" />
  ),
};

export const FullHeight = {
  args: {
    data: thousandTableRows,
    toolbarStorageKey: "storybook-data-table-full-height",
  },
  parameters: {
    pagePadding: 0,
    pageHeight: "100vh",
  },
  render: (args: DataTableProps) => {
    return <DataTableStoryContainer args={args} height="100%" />;
  },
};

export const Paginated = {
  args: {
    data: generateTableRows(96),
    initialPageSize: 10,
    pageSizeOptions: [10, 20, 50],
    compactHeaders,
    toolbarStorageKey: "storybook-data-table-paginated",
  },
  render: (args: DataTableProps) => {
    return <DataTableStoryContainer args={args} maxWidth="1080px" height="520px" marginX="auto" />;
  },
};

export const SelectableRows = {
  args: {
    data: generateTableRows(48),
    initialPageSize: 10,
    selectionMode: "multiple",
    selectionActions,
    compactHeaders,
    toolbarStorageKey: "storybook-data-table-selectable-rows",
  },
  render: (args: DataTableProps) => {
    return <DataTableStoryContainer args={args} maxWidth="1080px" height="520px" marginX="auto" />;
  },
};

export const RowActions = {
  args: {
    data: generateTableRows(36),
    initialPageSize: 10,
    rowActions,
    compactHeaders,
    toolbarStorageKey: "storybook-data-table-row-actions",
  },
  render: (args: DataTableProps) => {
    return <DataTableStoryContainer args={args} maxWidth="1080px" height="520px" marginX="auto" />;
  },
};

export const RowActivation = {
  args: {
    data: generateTableRows(36),
    initialPageSize: 10,
    compactHeaders,
    enableRowActivation: true,
    toolbarStorageKey: "storybook-data-table-row-activation",
  },
  render: (args: DataTableProps) => {
    return <DataTableStoryContainer args={args} maxWidth="1080px" height="520px" marginX="auto" />;
  },
};

export const EditableCells = {
  args: {
    data: generateTableRows(18),
    initialPageSize: 10,
    compactHeaders,
    toolbarStorageKey: "storybook-data-table-editable-cells",
  },
  render: (args: DataTableProps) => {
    return <EditableCellsRenderer args={args} maxWidth="1080px" height="580px" marginX="auto" />;
  },
};

export const TagRichRows = {
  args: {
    data: generateTableRows(48),
    initialPageSize: 10,
    pageSizeOptions: [10, 20, 30],
    selectionMode: "multiple",
    selectionActions,
    rowActions,
    compactHeaders,
    toolbarStorageKey: "storybook-data-table-tag-rich-rows",
  },
  render: (args: DataTableProps) => {
    return <DataTableStoryContainer args={args} maxWidth="1180px" height="560px" marginX="auto" />;
  },
};

export const ColumnManagement = {
  args: {
    data: columnManagementRows,
    initialPageSize: 10,
    pageSizeOptions: [10, 20, 30],
    selectionMode: "multiple",
    selectionActions,
    rowActions,
    compactHeaders,
    toolbarStorageKey: "storybook-data-table-column-management",
  },
  render: (args: DataTableProps) => {
    return <DataTableStoryContainer args={args} maxWidth="1180px" height="560px" marginX="auto" />;
  },
};
