import { Badge, HStack } from "@chakra-ui/react";
import type { RowData } from "./types";

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

const statusCell = (label: string, colorPalette: string) => ({
  display: (
    <Badge colorPalette={colorPalette} variant="subtle" textStyle="label/S/medium" px="xs" py="4px">
      {label}
    </Badge>
  ),
  sortValue: label,
});

const tagCell = (labels: string[]) => ({
  display: (
    <HStack gap="2xs" flexWrap="wrap">
      {labels.map((label) => (
        <Badge key={label} variant="outline" colorPalette="gray" textStyle="label/XS/medium">
          {label}
        </Badge>
      ))}
    </HStack>
  ),
  sortValue: labels.join(", "),
});

export const tableRows: RowData[] = [
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

export const generateTableRows = (count: number) => {
  const rows: RowData[] = [];

  for (let index = 0; index < count; index++) {
    const invoiceNumber = index + 1;
    const invoiceId = invoiceNumber.toString().padStart(4, "0");
    const statusOption = statusOptions[index % statusOptions.length];
    const month = String((index % 12) + 1).padStart(2, "0");
    const day = String((index % 28) + 1).padStart(2, "0");
    const region = regions[index % regions.length];
    const priority = priorities[index % priorities.length];

    rows.push({
      id: `inv-${invoiceId}`,
      Invoice: `INV-${invoiceId}`,
      Vendor: vendors[index % vendors.length],
      "Due Date": `2024-${month}-${day}`,
      Amount: Number((950 + invoiceNumber * 3.25).toFixed(2)),
      Approved: invoiceNumber % 2 === 0,
      Status: statusCell(statusOption.label, statusOption.colorPalette),
      Region: region,
      Department: departments[index % departments.length],
      Priority: priority,
      "Payment Method": paymentMethods[index % paymentMethods.length],
      Tags: tagCell([region, priority]),
    });
  }

  return rows;
};

export const thousandTableRows = generateTableRows(1000);

export const columnManagementRows: RowData[] = generateTableRows(24).map((row, index) => {
  const region = regions[index % regions.length];
  const priority = priorities[index % priorities.length];

  return {
    ...row,
    Vendor: `${row.Vendor} - Enterprise Shared Services and Procurement Operations ${index + 1}`,
    Tags: tagCell([region, priority, "multi-market", "renewal", "quarter-close", "needs-review"]),
  };
});
