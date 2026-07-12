import { Box } from "@chakra-ui/react";
import { DataTable, type DataTableProps } from ".";
import { friendlyJsonRows } from "./data-table.story-fixtures";

const meta = {
  title: "Components/Data Display/Data Table",
  component: DataTable,
};

export default meta;

export const FriendlyJson = {
  args: {
    data: friendlyJsonRows,
    hiddenColumns: ["id"],
    columnRenderers: { Profile: { type: "json" } },
    toolbarStorageKey: "storybook-data-table-friendly-json",
  },
  render: (args: DataTableProps) => (
    <Box width="100%" maxWidth="820px" height="420px" marginX="auto" padding="sm" background="bg">
      <DataTable {...args} />
    </Box>
  ),
};
