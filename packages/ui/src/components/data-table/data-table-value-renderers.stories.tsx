import { Box } from "@chakra-ui/react";
import { expect, userEvent, within } from "storybook/test";
import { DataTable, type DataTableProps, type RowData } from ".";

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

const workspaceRows: RowData[] = [
  {
    Name: "Project workspace",
    Type: "Project folder",
    Location: "/Users/alex/Projects/prompt-studio",
    Created: hoursAgo(72),
    Diff: "Not supported",
    Provider: "pstdio.root",
  },
  {
    Name: "Workspace list defaults",
    Type: "Git worktree",
    Location: "/Users/alex/.pstdio/workspaces/5c64c4e9-82c0-4be1-989a-4eb1b95d9345/prompt-studio",
    Created: hoursAgo(5),
    Diff: { additions: 128, deletions: 14 },
    Provider: "pstdio.worktree",
  },
  {
    Name: "Clean worktree",
    Type: "Git worktree",
    Location: "/Users/alex/.pstdio/workspaces/0b1f/prompt-studio",
    Created: hoursAgo(1),
    Diff: { additions: 0, deletions: 0 },
    Provider: "pstdio.worktree",
  },
  {
    Name: "Remote runner",
    Type: "Remote workspace",
    Location: "remote://runner-42/workspace",
    Created: hoursAgo(0.5),
    Diff: "Not supported",
    Provider: "example.remote",
  },
];

const valueRenderers: DataTableProps["columnRenderers"] = {
  Type: {
    type: "badge",
    categories: [
      { value: "Project folder", palette: "gray" },
      { value: "Git worktree", palette: "purple" },
      { value: "Remote workspace", palette: "blue" },
    ],
  },
  Location: { type: "path" },
  Created: { type: "date" },
  Diff: { type: "diff" },
};

const meta = {
  title: "Components/Data Display/Data Table",
  component: DataTable,
};

export default meta;

const StoryFrame = (args: DataTableProps) => (
  <Box width="100%" maxWidth="880px" height="440px" marginX="auto" padding="sm" background="bg">
    <DataTable {...args} />
  </Box>
);

export const ValueRenderers = {
  parameters: {
    docs: {
      description: {
        story:
          "Relative dates refresh every minute while the table stays open. Hover or focus a date to read its full timestamp.",
      },
    },
  },
  args: {
    data: workspaceRows,
    fullWidth: true,
    columnRenderers: valueRenderers,
    toolbarStorageKey: "storybook-data-table-value-renderers",
  },
  render: StoryFrame,
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText("Git worktree")[0]).toBeVisible();
    await expect(canvas.getByText("+128")).toBeVisible();
    await expect(canvas.getByText("+0")).toBeVisible();
    await expect(canvas.getByText("5 hours ago")).toBeVisible();
    const fullPath = String(workspaceRows[1]!.Location);
    await expect(
      canvas.getByText((_, element) => element?.getAttribute("tabindex") === "0" && element.textContent === fullPath),
    ).toBeVisible();
  },
};

export const DefaultDisplay = {
  args: {
    data: workspaceRows,
    fullWidth: true,
    columnRenderers: valueRenderers,
    columnStats: { Type: { type: "top-values", limit: 3 }, Provider: { type: "top-values", limit: 3 } },
    defaultSettings: { showStats: false, hiddenColumns: ["Provider"] },
    toolbarStorageKey: "storybook-data-table-default-display",
  },
  render: StoryFrame,
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText("pstdio.root")).toBeNull();
    await expect(canvas.queryByText("50%")).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Display settings" }));
    const menu = within(await within(document.body).findByRole("dialog"));
    await userEvent.click(menu.getByText("Statistics"));
    await userEvent.click(menu.getByText("Provider"));
    // The value shows in its cell and, once statistics load, in the column's top values.
    await expect((await canvas.findAllByText("pstdio.root"))[0]).toBeVisible();
    await expect((await canvas.findAllByText("50%")).length).toBeGreaterThan(0);
  },
};

export const SearchCellValues = {
  args: {
    data: [
      { Name: { display: "Completed", sortValue: 1 }, Created: hoursAgo(5), Diff: { additions: 128, deletions: 14 } },
      { Name: { display: "Pending", sortValue: 2 }, Created: hoursAgo(1), Diff: { additions: 0, deletions: 0 } },
    ],
    columnRenderers: { Created: { type: "date" }, Diff: { type: "diff" } },
    fullWidth: true,
    toolbarStorageKey: "storybook-data-table-search-cell-values",
    defaultSettings: { showStats: false },
  },
  render: StoryFrame,
};
