import { Box, Icon as ChakraIcon } from "@chakra-ui/react";
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
  Trash2,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { DataTable, type DataTableProps, type RowData } from ".";
import { columnDescriptions } from "./data-table.story-descriptions";
import { columnManagementRows, generateTableRows, tableRows, thousandTableRows } from "./data-table.story-fixtures";
import { EditableCellsStory } from "./editable-cells-story";

type StoryFn = () => ReactNode;

interface StoryContext {
  parameters?: {
    pageHeight?: string;
    pagePadding?: string | number;
  };
}

interface PlayContext {
  canvasElement: HTMLElement;
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

const singleValueRows = generateTableRows(24).map((row) => ({
  ...row,
  Amount: 1_200,
  Status: tableRows[0]!.Status,
}));

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
  play: async ({ canvasElement }: PlayContext) => {
    const canvas = within(canvasElement);
    const addViewButton = canvas.getByRole("button", { name: "Add view" });
    const body = within(document.body);

    await userEvent.hover(addViewButton);
    await expect(await body.findByRole("tooltip")).toHaveTextContent("Add view");
    await userEvent.unhover(addViewButton);
    await waitFor(() => expect(body.queryByRole("tooltip")).not.toBeInTheDocument());
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
  play: async ({ canvasElement }: PlayContext) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByLabelText("Display settings"));
    const displayMenu = within(document.body);
    const columnMenu = within(displayMenu.getByRole("dialog"));
    const invoiceCheckbox = columnMenu.getByRole("checkbox", { name: "Invoice" });
    await userEvent.click(columnMenu.getByText("Invoice", { exact: true }));
    await expect(invoiceCheckbox).not.toBeChecked();
    await expect(canvas.queryByRole("columnheader", { name: "Invoice" })).not.toBeInTheDocument();

    await userEvent.click(columnMenu.getByText("Invoice", { exact: true }));
    await expect(columnMenu.getByRole("checkbox", { name: "Invoice" })).toBeChecked();
    await expect(canvas.getByRole("columnheader", { name: "Invoice" })).toBeInTheDocument();

    const statisticsSwitch = columnMenu.getByRole("switch", { name: "Statistics" });
    await expect(statisticsSwitch).toBeChecked();
    await userEvent.click(displayMenu.getByText("Statistics", { exact: true }));
    await expect(statisticsSwitch).not.toBeChecked();
    await expect(canvasElement.querySelector(".data-table-stats-row")).not.toBeInTheDocument();
  },
};

export const SingleValueStats = {
  args: {
    data: singleValueRows,
    initialPageSize: 20,
    columnStats: {
      Amount: { type: "histogram", bins: 8 },
      Status: { type: "top-values", limit: 3 },
    },
    toolbarStorageKey: "storybook-data-table-single-value-stats",
  },
  render: (args: DataTableProps) => {
    return <DataTableStoryContainer args={args} maxWidth="1080px" height="520px" marginX="auto" />;
  },
  play: async ({ canvasElement }: PlayContext) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getByText(new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(1200)),
    ).toBeInTheDocument();
    await expect(canvas.getByText("Paid", { selector: "[data-single-value-stat] *" })).toBeInTheDocument();
    await expect(canvas.queryByLabelText("Distribution for Amount")).not.toBeInTheDocument();
    await expect(canvas.queryByLabelText("Paid: 100%")).not.toBeInTheDocument();
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
  play: async ({ canvasElement }: PlayContext) => {
    const canvas = within(canvasElement);
    const header = canvas.getByTestId("kanban-renderer-header");
    const rowSelectors = canvas.getAllByLabelText("Select row");

    await expect(within(header).queryByText("48 rows")).not.toBeInTheDocument();
    await userEvent.click(rowSelectors[0]!);
    await userEvent.click(rowSelectors[1]!);

    const selectionBar = canvas.getByRole("toolbar", { name: "Selection actions" });
    const selectionOverlay = selectionBar.parentElement;
    await expect(selectionBar).toHaveTextContent("2 rows selected");
    await expect(selectionOverlay).not.toBeNull();
    await expect(getComputedStyle(selectionOverlay!).position).toBe("absolute");
    await expect(within(header).getByText("All")).toBeInTheDocument();
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
    return <EditableCellsStory args={args} maxWidth="1080px" height="580px" marginX="auto" />;
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
