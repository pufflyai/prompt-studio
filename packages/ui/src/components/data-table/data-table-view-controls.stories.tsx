import { Box } from "@chakra-ui/react";
import { DEFAULT_DATA_TABLE_SETTINGS } from "@pstdio/sdk/extensions";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";
import { DataTable } from "./data-table";
import type { DataTableProps, DataTableSavedView, DataTableViewsSource, RowData } from "./types";
import { useDataTableViewStore } from "./use-data-table-view";

const meta: Meta<typeof DataTable> = {
  title: "Patterns/Data Table/View Controls",
  component: DataTable,
  parameters: { layout: "fullscreen" },
};

export default meta;

type Story = StoryObj;

const statuses = ["In review", "In progress", "Todo", "Backlog"];
const priorities = ["Urgent", "High", "Medium"];
const titles = [
  "Improve chat and data tables",
  "Show sidebar shortcuts at rest",
  "Feature-slice @pstdio/ui",
  "Chat scroll jumps while streaming",
  "Harness run parameters",
  "Bubblify the side panel across resources",
  "Saved filters for views",
  "Archived filter by default",
];
const ticketRows: RowData[] = titles.map((title, index) => ({
  id: `PS-${151 - index * 3}`,
  Title: title,
  Status: index === 5 ? null : statuses[index % statuses.length],
  Priority: priorities[index % priorities.length],
  Score: 92 - index * 9,
  Updated: new Date(Date.UTC(2026, 9, 2 - index)).toISOString(),
}));

const tableProps = {
  data: ticketRows,
  fullWidth: true,
  columnTypes: { Score: "number", Updated: "date" },
  groupableColumns: ["Status", "Priority"],
  columnRenderers: { Updated: { type: "date" } },
} satisfies Partial<DataTableProps>;

interface TableProps extends Partial<DataTableProps> {
  storageKey: string;
}

const Table = (props: TableProps) => {
  const { storageKey, ...rest } = props;
  const reset = useDataTableViewStore(storageKey, (state) => state.reset, rest);
  // Reset during the first render, before the renderer picks its first view in an effect.
  useState(reset);
  return (
    <Box height="32rem">
      <DataTable {...tableProps} {...rest} toolbarStorageKey={storageKey} />
    </Box>
  );
};

/** The header menu replaces the view's sorts with one column and shows its direction. */
export const HeaderSort: Story = {
  render: () => <Table storageKey="storybook-data-table-header-sort" />,
  play: async ({ canvasElement }) => {
    const header = canvasElement.querySelector('[data-column-id="Score"]') as HTMLElement;
    await userEvent.click(within(header).getByRole("button", { name: "Column options" }));
    await userEvent.click(await within(document.body).findByText("Sort ascending"));
    await expect(within(header).getByRole("button", { name: "Sorted asc" })).toBeVisible();
  },
};

export const SearchHighlights: Story = {
  render: () => <Table storageKey="storybook-data-table-search" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Search this view" }));
    await userEvent.type(canvas.getByRole("textbox", { name: "Search this view" }), "chat");
    await expect(await canvas.findAllByRole("mark")).toHaveLength(2);
    await expect(canvas.getByText("2 of 8")).toBeVisible();
  },
};

const SavedViewsTable = () => {
  const [views, setViews] = useState<(DataTableSavedView & { builtIn: boolean })[]>([
    {
      id: "all",
      title: "All rows",
      settings: DEFAULT_DATA_TABLE_SETTINGS,
      filter: { conjunction: "and", rules: [] },
      sorts: [],
      builtIn: true,
    },
    {
      id: "high-score",
      title: "High score",
      settings: { ...DEFAULT_DATA_TABLE_SETTINGS, rowNumbers: false },
      filter: { conjunction: "and", rules: [{ attributeId: "Score", condition: "gte", value: 70 }] },
      sorts: [{ attributeId: "Score", direction: "desc" }],
      builtIn: false,
    },
  ]);
  const viewsSource: DataTableViewsSource = {
    views,
    defaultViewId: "all",
    onCreateView: async (input) => {
      const view = { ...input, id: crypto.randomUUID(), builtIn: false };
      setViews((current) => [...current, view]);
      return view;
    },
    onUpdateView: async (id, input) =>
      setViews((current) => current.map((view) => (view.id === id ? { ...view, ...input } : view))),
    onDeleteView: async (id) => setViews((current) => current.filter((view) => view.id !== id)),
    onSetDefaultView: async () => undefined,
  };
  return <Table storageKey="storybook-data-table-saved-views" viewsSource={viewsSource} />;
};

/** Filters, sorts, and display settings belong to the saved view. */
export const SavedViews: Story = {
  render: () => <SavedViewsTable />,
  play: async ({ canvasElement }) => {
    fireEvent.contextMenu(within(canvasElement).getByRole("tab", { name: "High score", exact: true }));
    const menu = await within(document.body).findByRole("menu");
    const viewport = menu.querySelector('[data-part="viewport"]')!;
    await waitFor(() => expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth));
    expect(viewport.scrollHeight).toBeLessThanOrEqual(viewport.clientHeight);
    const items = within(menu).getAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual(["Rename", "Duplicate", "Delete view"]);
    expect(menu.querySelectorAll('[data-part="separator"]')).toHaveLength(1);
  },
};

/** Rows group by value in option order; empty values form the last group, and collapsing is screen state. */
export const GroupedByStatus: Story = {
  render: () => (
    <Table
      storageKey="storybook-data-table-grouped"
      defaultSettings={{ grouping: "Status", rowNumbers: false }}
      defaultSorts={[{ attributeId: "Priority", direction: "asc" }]}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByTestId("data-table-group-row")).toHaveLength(5);
  },
};

export const RowNumbersHidden: Story = {
  render: () => <Table storageKey="storybook-data-table-no-row-numbers" defaultSettings={{ rowNumbers: false }} />,
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-column-id="rowIndex"]')).toBeNull();
  },
};

/** A new sort, filter, grouping, or search starts again on the first page. */
export const PageResetsOnViewChange: Story = {
  render: () => <Table storageKey="storybook-data-table-page-reset" initialPageSize={3} pageSizeOptions={[3, 10]} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Go to next page" }));
    await expect(canvas.getByRole("button", { name: "Go to previous page" })).toBeEnabled();
    const header = canvasElement.querySelector('[data-column-id="Score"]') as HTMLElement;
    await userEvent.click(within(header).getByRole("button", { name: "Column options" }));
    await userEvent.click(await within(document.body).findByText("Sort ascending"));
    await expect(canvas.getByRole("button", { name: "Go to previous page" })).toBeDisabled();
  },
};

export const EmptyFilteredGroups: Story = {
  render: () => (
    <Table
      storageKey="storybook-empty-table-groups"
      defaultSettings={{ grouping: "Status" }}
      defaultFilter={{ conjunction: "and", rules: [{ attributeId: "Score", condition: "gt", value: 1000 }] }}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("In review", { exact: true })).toBeVisible();
    await expect(canvas.getByText("In progress", { exact: true })).toBeVisible();
    await expect(canvas.getByText("No status", { exact: true })).toBeVisible();
  },
};
