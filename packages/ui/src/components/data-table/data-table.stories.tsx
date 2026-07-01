import { Badge, Box, Icon as ChakraIcon } from "@chakra-ui/react";
import {
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
} from "lucide-react";
import { type ReactNode, useState } from "react";

import { DataTable, type DataTableProps, type RowData } from ".";

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

const statusCell = (label: string, colorPalette: string) => ({
  display: (
    <Badge colorPalette={colorPalette} variant="subtle" textStyle="label/S/medium" px="xs" py="4px">
      {label}
    </Badge>
  ),
  sortValue: label,
});

const vendors = ["Northwind Traders", "Fabrikam Logistics", "Contoso Supplies", "Adventure Works"];
const regions = ["North America", "Europe", "APAC", "LATAM"];
const departments = ["Finance", "Operations", "Logistics", "Procurement"];
const priorities = ["Low", "Medium", "High"];
const paymentMethods = ["Wire", "Card", "ACH", "Check"];

const statusOptions = [
  { label: "Paid", colorPalette: "green" },
  { label: "Pending", colorPalette: "yellow" },
  { label: "Overdue", colorPalette: "red" },
];

const tableRows: RowData[] = [
  {
    id: "inv-001",
    Invoice: "INV-001",
    Vendor: vendors[0],
    "Due Date": "2024-06-12",
    Amount: 1280.5,
    Approved: true,
    Status: statusCell(statusOptions[0].label, statusOptions[0].colorPalette),
    Region: regions[0],
    Department: departments[0],
    Priority: priorities[2],
    "Payment Method": paymentMethods[0],
  },
  {
    id: "inv-002",
    Invoice: "INV-002",
    Vendor: vendors[1],
    "Due Date": "2024-06-18",
    Amount: 812.2,
    Approved: false,
    Status: statusCell(statusOptions[1].label, statusOptions[1].colorPalette),
    Region: regions[1],
    Department: departments[1],
    Priority: priorities[1],
    "Payment Method": paymentMethods[1],
  },
  {
    id: "inv-003",
    Invoice: "INV-003",
    Vendor: vendors[2],
    "Due Date": "2024-06-25",
    Amount: 2640,
    Approved: true,
    Status: statusCell(statusOptions[2].label, statusOptions[2].colorPalette),
    Region: regions[2],
    Department: departments[2],
    Priority: priorities[0],
    "Payment Method": paymentMethods[2],
  },
];

const generateTableRows = (count: number) => {
  const rows: RowData[] = [];

  for (let index = 0; index < count; index++) {
    const invoiceNumber = index + 1;
    const invoiceId = invoiceNumber.toString().padStart(4, "0");
    const statusOption = statusOptions[index % statusOptions.length];
    const month = String((index % 12) + 1).padStart(2, "0");
    const day = String((index % 28) + 1).padStart(2, "0");
    const amount = Number((950 + invoiceNumber * 3.25).toFixed(2));
    const region = regions[index % regions.length];
    const department = departments[index % departments.length];
    const priority = priorities[index % priorities.length];
    const paymentMethod = paymentMethods[index % paymentMethods.length];

    rows.push({
      id: `inv-${invoiceId}`,
      Invoice: `INV-${invoiceId}`,
      Vendor: vendors[index % vendors.length],
      "Due Date": `2024-${month}-${day}`,
      Amount: amount,
      Approved: invoiceNumber % 2 === 0,
      Status: statusCell(statusOption.label, statusOption.colorPalette),
      Region: region,
      Department: department,
      Priority: priority,
      "Payment Method": paymentMethod,
    });
  }

  return rows;
};

const thousandTableRows = generateTableRows(1000);

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
  },
};

export default meta;

export const Default = {
  render: (args: DataTableProps) => {
    return <DataTableStoryContainer args={args} maxWidth="960px" height="420px" marginX="auto" />;
  },
};

export const FullHeight = {
  args: {
    data: thousandTableRows,
  },
  parameters: {
    pagePadding: 0,
    pageHeight: "100vh",
  },
  render: (args: DataTableProps) => {
    return <DataTableStoryContainer args={args} height="100%" />;
  },
};
