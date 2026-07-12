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

const profileImage = (initials: string, background: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" rx="20" fill="${background}"/><text x="48" y="57" text-anchor="middle" font-family="Arial" font-size="30" fill="white">${initials}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

export const friendlyJsonRows: RowData[] = [
  {
    id: "customer-1",
    Customer: "Mina Patel",
    Segment: "Growing business",
    Profile: {
      avatar: profileImage("MP", "#6D5BD0"),
      gallery: [profileImage("01", "#C05A7A"), profileImage("02", "#427AA1"), profileImage("03", "#4F8A5B")],
      contact: { email: "mina@northstar.co", phone: "+46 70 555 01 42" },
      location: { city: "Stockholm", country: "Sweden" },
      interests: ["Design", "Travel", "Sustainability"],
      verified: true,
    },
  },
  {
    id: "customer-2",
    Customer: "Jordan Lee",
    Segment: "Enterprise",
    Profile: JSON.stringify({
      profileImage: profileImage("JL", "#197278"),
      contact: { email: "jordan@atlas.group", phone: "+44 20 7946 0921" },
      location: { city: "London", country: "United Kingdom" },
      interests: ["Operations", "Cycling"],
      verified: true,
    }),
  },
  {
    id: "customer-3",
    Customer: "Sam Rivera",
    Segment: "Independent",
    Profile: {
      photo: profileImage("SR", "#D17B49"),
      contact: { email: "sam@example.com", phone: null },
      location: { city: "Madrid", country: "Spain" },
      interests: ["Photography", "Food"],
      verified: false,
    },
  },
];
