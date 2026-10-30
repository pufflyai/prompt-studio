import { Box } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { DataTable } from "./data-table";

const data = Array.from({ length: 24 }, (_, index) => ({ Name: `Item ${index + 1}`, Amount: index + 1 }));
const meta: CanvasMeta<typeof DataTable> = {
  title: "Components/Data Display/Data Table Display",
  component: DataTable,
  decorators: [
    (Story) => (
      <Box height="96" padding="sm">
        <Story />
      </Box>
    ),
  ],
  args: { data, initialPageSize: 10 },
};
export default meta;
type Story = CanvasVariant<typeof DataTable>;
/** Statistics charts load when enabled, including after an initial render without them. */
export const EnableStatistics: Story = {
  id: "components-data-display-data-table-display--enable-statistics",
  args: {
    toolbarStorageKey: "storybook-enable-table-statistics",
    defaultSettings: { showStats: false },
    columnStats: { Amount: { type: "histogram", bins: 4 } },
  },
};
/** Pagination remains available when the filtered result spans several pages. */
export const FilteredPagination: Story = {
  id: "components-data-display-data-table-display--filtered-pagination",
  args: {
    toolbarStorageKey: "storybook-filtered-table-pagination",
    defaultFilter: { conjunction: "and", rules: [{ attributeId: "Amount", condition: "gt", value: 3 }] },
  },
};
