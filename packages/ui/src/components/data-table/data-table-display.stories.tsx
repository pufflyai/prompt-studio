import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { DataTable } from "./data-table";

const data = Array.from({ length: 24 }, (_, index) => ({ Name: `Item ${index + 1}`, Amount: index + 1 }));

const meta: Meta<typeof DataTable> = {
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
type Story = StoryObj<typeof DataTable>;

/** Statistics load when enabled, including when the first render did not need the stats chunk. */
export const EnableStatistics: Story = {
  args: {
    toolbarStorageKey: "storybook-enable-table-statistics",
    defaultSettings: { showStats: false },
    columnStats: { Amount: { type: "histogram", bins: 4 } },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "Display settings" }));
    const dialog = within(await body.findByRole("dialog"));
    await userEvent.click(dialog.getByText("Statistics", { exact: true }));
    await expect(dialog.getByRole("switch", { name: /^Statistics/ })).toBeChecked();
    await expect(await canvas.findByLabelText("Distribution for Amount")).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await userEvent.click(canvas.getByRole("button", { name: "Go to next page" }));
    await expect(canvas.getByRole("cell", { name: "Item 11", exact: true })).toBeVisible();
    await expect(canvas.getByLabelText("Distribution for Amount")).toBeVisible();
  },
};

/** Pagination remains available when the filtered result spans several pages. */
export const FilteredPagination: Story = {
  args: {
    toolbarStorageKey: "storybook-filtered-table-pagination",
    defaultFilter: { conjunction: "and", rules: [{ attributeId: "Amount", condition: "gt", value: 3 }] },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("cell", { name: "Item 4", exact: true })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Go to next page" }));
    await expect(canvas.getByRole("cell", { name: "Item 14", exact: true })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Go to last page" }));
    await expect(canvas.getByRole("cell", { name: "Item 24", exact: true })).toBeVisible();
  },
};
