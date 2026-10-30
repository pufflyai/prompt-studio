import { Box } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { DEFAULT_DATA_TABLE_SETTINGS } from "@pstdio/sdk/extensions";
import { useState } from "react";
import { DataTable } from "./data-table";
import type { DataTableProps, DataTableSavedView, DataTableViewsSource, RowData } from "./types";
import { useDataTableViewStore } from "./use-data-table-view";

const meta: CanvasMeta<typeof DataTable> = {
  title: "Patterns/Data Table/View Controls",
  component: DataTable,
  fullscreen: true,
};
export default meta;
type Story = CanvasVariant;
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
  id: "patterns-data-table-view-controls--header-sort",
  render: () => <Table storageKey="preview-data-table-header-sort" />,
};
export const SearchHighlights: Story = {
  id: "patterns-data-table-view-controls--search-highlights",
  render: () => <Table storageKey="preview-data-table-search" />,
};
const SavedViewsTable = () => {
  const [views, setViews] = useState<
    (DataTableSavedView & {
      builtIn: boolean;
    })[]
  >([
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
  return <Table storageKey="preview-data-table-saved-views" viewsSource={viewsSource} />;
};
/** Filters, sorts, and display settings belong to the saved view. */
export const SavedViews: Story = {
  id: "patterns-data-table-view-controls--saved-views",
  render: () => <SavedViewsTable />,
};
/** Rows group by value in option order; empty values form the last group, and collapsing is screen state. */
export const GroupedByStatus: Story = {
  id: "patterns-data-table-view-controls--grouped-by-status",
  render: () => (
    <Table
      storageKey="preview-data-table-grouped"
      defaultSettings={{ grouping: "Status", rowNumbers: false }}
      defaultSorts={[{ attributeId: "Priority", direction: "asc" }]}
    />
  ),
};
export const RowNumbersHidden: Story = {
  id: "patterns-data-table-view-controls--row-numbers-hidden",
  render: () => <Table storageKey="preview-data-table-no-row-numbers" defaultSettings={{ rowNumbers: false }} />,
};
/** A new sort, filter, grouping, or search starts again on the first page. */
export const PageResetsOnViewChange: Story = {
  id: "patterns-data-table-view-controls--page-resets-on-view-change",
  render: () => <Table storageKey="preview-data-table-page-reset" initialPageSize={3} pageSizeOptions={[3, 10]} />,
};
export const EmptyFilteredGroups: Story = {
  id: "patterns-data-table-view-controls--empty-filtered-groups",
  render: () => (
    <Table
      storageKey="preview-empty-table-groups"
      defaultSettings={{ grouping: "Status" }}
      defaultFilter={{ conjunction: "and", rules: [{ attributeId: "Score", condition: "gt", value: 1000 }] }}
    />
  ),
};
