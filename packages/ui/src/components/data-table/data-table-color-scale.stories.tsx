import { Box } from "@chakra-ui/react";
import { DataTable, type DataTableProps, type RowData } from ".";

const scoreRows: RowData[] = [
  { Team: "North", Completion: 0, Variance: -100, Health: 12 },
  { Team: "South", Completion: 20, Variance: -60, Health: 34 },
  { Team: "East", Completion: 40, Variance: -20, Health: 49 },
  { Team: "West", Completion: 60, Variance: 20, Health: 63 },
  { Team: "Central", Completion: 80, Variance: 60, Health: 82 },
  { Team: "International", Completion: 100, Variance: 100, Health: 96 },
];

const statusRows: RowData[] = [
  { Project: "Website launch", Owner: "Maya", Status: "On track" },
  { Project: "Mobile refresh", Owner: "Noah", Status: "At risk" },
  { Project: "Billing migration", Owner: "Ava", Status: "Blocked" },
  { Project: "Customer research", Owner: "Leo", Status: "Complete" },
  { Project: "Partner rollout", Owner: "Mia", Status: "On track" },
];

const meta = {
  title: "Components/Data Display/Data Table",
  component: DataTable,
};

export default meta;

const themedColor = (light: string, dark: string) => ({ light, dark });

const StoryFrame = (args: DataTableProps) => (
  <Box width="100%" maxWidth="880px" height="440px" marginX="auto" padding="sm" background="bg">
    <DataTable {...args} />
  </Box>
);

export const ColorScales = {
  args: {
    data: scoreRows,
    fullWidth: true,
    columnRenderers: {
      Completion: {
        type: "color-scale",
        stops: [
          { value: 0, color: themedColor("#fee2e2", "#580707") },
          { value: 100, color: themedColor("#bbf7d0", "#003110") },
        ],
      },
      Variance: {
        type: "color-scale",
        stops: [
          { value: -100, color: themedColor("#bfdbfe", "#002862") },
          { value: 0, color: themedColor("#f3f4f6", "#33363e") },
          { value: 100, color: themedColor("#fecaca", "#580707") },
        ],
      },
      Health: {
        type: "color-scale",
        stops: [
          { value: 0, color: themedColor("#fecaca", "#580707") },
          { value: 50, color: themedColor("#fde68a", "#644e00") },
          { value: 100, color: themedColor("#bbf7d0", "#003110") },
        ],
      },
    },
    columnStats: { Health: { type: "histogram" } },
    toolbarStorageKey: "storybook-data-table-color-scales",
  },
  render: StoryFrame,
};

export const CategoricalColors = {
  args: {
    data: statusRows,
    fullWidth: true,
    columnRenderers: {
      Status: {
        type: "categorical-color",
        categories: [
          { value: "On track", color: themedColor("#bbf7d0", "#003110") },
          { value: "At risk", color: themedColor("#fde68a", "#644e00") },
          { value: "Blocked", color: themedColor("#fecaca", "#580707") },
          { value: "Complete", color: themedColor("#bfdbfe", "#002862") },
        ],
      },
    },
    columnStats: { Status: { type: "top-values", limit: 3 } },
    toolbarStorageKey: "storybook-data-table-categorical-colors",
  },
  render: StoryFrame,
};
