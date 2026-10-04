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

import { DataTable, type DataTableProps, type RowData } from ".";
import { generateTableRows, tableRows } from "./data-table.story-fixtures";

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

export const columnIcons: DataTableProps["columnIcons"] = {
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

export const compactHeaders: DataTableProps["compactHeaders"] = {
  Invoice: "Inv",
  Vendor: "Vendor",
  "Due Date": "Due",
  "Payment Method": "Pay",
};

export const selectionActions: DataTableProps["selectionActions"] = [
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

export const rowActions: DataTableProps["rowActions"] = [
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

export const singleValueRows = generateTableRows(24).map((row) => ({
  ...row,
  Amount: 1_200,
  Status: tableRows[0]!.Status,
}));

export const withStoryPage = (Story: StoryFn, context: StoryContext) => {
  const pagePadding = context.parameters?.pagePadding ?? "sm";
  const pageHeight = context.parameters?.pageHeight;

  return (
    <Box padding={pagePadding} background="bg" height={pageHeight}>
      <Story />
    </Box>
  );
};

export const DataTableStoryContainer = (props: DataTableStoryContainerProps) => {
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
