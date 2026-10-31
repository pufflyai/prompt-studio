import { DataTable, type DataTableProps, type RowData } from ".";
import { columnDescriptions } from "./data-table.story-descriptions";
import { columnManagementRows, generateTableRows, tableRows, thousandTableRows } from "./data-table.story-fixtures";
import {
  columnIcons,
  compactHeaders,
  DataTableStoryContainer,
  rowActions,
  selectionActions,
  singleValueRows,
  storyPage,
} from "./data-table-story";
import {
  EditableSelectableRowsStory,
  EditableWithViewsStory,
  EditModeStory,
  ModeToggleStory,
  RichTextEditModeStory,
} from "./edit-mode-story";

const meta = {
  title: "Components/Data Display/Data Table",
  component: DataTable,
  args: {
    data: tableRows,
    hiddenColumns: ["id"],
    columnIcons,
    toolbarStorageKey: "preview-data-table-default",
  },
};
export default meta;
export const Default = {
  id: "components-data-display-data-table--default",
  decorators: [storyPage()],
  render: (args: DataTableProps) => {
    return <DataTableStoryContainer args={args} maxWidth="960px" height="420px" marginX="auto" />;
  },
};
export const ColumnStats = {
  id: "components-data-display-data-table--column-stats",
  decorators: [storyPage()],
  args: {
    data: generateTableRows(96),
    initialPageSize: 50,
    columnStats: {
      Invoice: { type: "unique" },
      Amount: { type: "histogram", bins: 12 },
      Status: { type: "top-values", limit: 2 },
      Region: { type: "top-values", limit: 2 },
    },
    toolbarStorageKey: "preview-data-table-column-stats",
  },
  render: (args: DataTableProps) => {
    return <DataTableStoryContainer args={args} maxWidth="1180px" height="560px" marginX="auto" />;
  },
};
export const SingleValueStats = {
  id: "components-data-display-data-table--single-value-stats",
  decorators: [storyPage()],
  args: {
    data: singleValueRows,
    initialPageSize: 20,
    columnStats: {
      Amount: { type: "histogram", bins: 8 },
      Status: { type: "top-values", limit: 3 },
    },
    toolbarStorageKey: "preview-data-table-single-value-stats",
  },
  render: (args: DataTableProps) => {
    return <DataTableStoryContainer args={args} maxWidth="1080px" height="520px" marginX="auto" />;
  },
};
export const ColumnDescriptions = {
  id: "components-data-display-data-table--column-descriptions",
  decorators: [storyPage()],
  args: {
    data: generateTableRows(24),
    columnDescriptions,
    toolbarStorageKey: "preview-data-table-column-descriptions",
  },
  render: (args: DataTableProps) => (
    <DataTableStoryContainer args={args} maxWidth="1080px" height="480px" marginX="auto" />
  ),
};
export const FullHeight = {
  id: "components-data-display-data-table--full-height",
  decorators: [storyPage(0, "100vh")],
  args: {
    data: thousandTableRows,
    toolbarStorageKey: "preview-data-table-full-height",
  },
  render: (args: DataTableProps) => {
    return <DataTableStoryContainer args={args} height="100%" />;
  },
};
export const Paginated = {
  id: "components-data-display-data-table--paginated",
  decorators: [storyPage()],
  args: {
    data: generateTableRows(96),
    initialPageSize: 10,
    pageSizeOptions: [10, 20, 50],
    compactHeaders,
    toolbarStorageKey: "preview-data-table-paginated",
  },
  render: (args: DataTableProps) => {
    return <DataTableStoryContainer args={args} maxWidth="1080px" height="520px" marginX="auto" />;
  },
};
export const SelectableRows = {
  id: "components-data-display-data-table--selectable-rows",
  decorators: [storyPage()],
  args: {
    data: generateTableRows(48),
    initialPageSize: 10,
    selectionMode: "multiple",
    selectionActions,
    compactHeaders,
    toolbarStorageKey: "preview-data-table-selectable-rows",
  },
  render: (args: DataTableProps) => {
    return <DataTableStoryContainer args={args} maxWidth="1080px" height="520px" marginX="auto" />;
  },
};
export const RowActions = {
  id: "components-data-display-data-table--row-actions",
  decorators: [storyPage()],
  args: {
    data: generateTableRows(36),
    initialPageSize: 10,
    rowActions,
    compactHeaders,
    toolbarStorageKey: "preview-data-table-row-actions",
  },
  render: (args: DataTableProps) => {
    return <DataTableStoryContainer args={args} maxWidth="1080px" height="520px" marginX="auto" />;
  },
};
export const DynamicRowActions = {
  id: "components-data-display-data-table--dynamic-row-actions",
  decorators: [storyPage()],
  args: {
    data: [
      { Invoice: "INV-001", Status: "Open" },
      { Invoice: "INV-002", Status: "Archived" },
    ],
    getRowActions: (row: RowData) => (row.Status === "Archived" ? [] : rowActions),
    compactHeaders,
    toolbarStorageKey: "preview-data-table-dynamic-row-actions",
  },
  render: (args: DataTableProps) => {
    return <DataTableStoryContainer args={args} maxWidth="1080px" height="520px" marginX="auto" />;
  },
};
export const RowActivation = {
  id: "components-data-display-data-table--row-activation",
  decorators: [storyPage()],
  args: {
    data: generateTableRows(36),
    initialPageSize: 10,
    compactHeaders,
    enableRowActivation: true,
    toolbarStorageKey: "preview-data-table-row-activation",
  },
  render: (args: DataTableProps) => {
    return <DataTableStoryContainer args={args} maxWidth="1080px" height="520px" marginX="auto" />;
  },
};
export const EditMode = {
  id: "components-data-display-data-table--edit-mode",
  decorators: [storyPage()],
  render: () => <EditModeStory />,
};
export const RichTextEditMode = {
  id: "components-data-display-data-table--rich-text-edit-mode",
  decorators: [storyPage()],
  render: () => <RichTextEditModeStory />,
};
export const ModeToggle = {
  id: "components-data-display-data-table--mode-toggle",
  decorators: [storyPage()],
  render: () => <ModeToggleStory />,
};
export const EditableSelectableRows = {
  id: "components-data-display-data-table--editable-selectable-rows",
  decorators: [storyPage()],
  render: () => <EditableSelectableRowsStory />,
};
export const EditableWithViews = {
  id: "components-data-display-data-table--editable-with-views",
  decorators: [storyPage()],
  render: () => <EditableWithViewsStory />,
};
export const TagRichRows = {
  id: "components-data-display-data-table--tag-rich-rows",
  decorators: [storyPage()],
  args: {
    data: generateTableRows(48),
    initialPageSize: 10,
    pageSizeOptions: [10, 20, 30],
    selectionMode: "multiple",
    selectionActions,
    rowActions,
    compactHeaders,
    toolbarStorageKey: "preview-data-table-tag-rich-rows",
  },
  render: (args: DataTableProps) => {
    return <DataTableStoryContainer args={args} maxWidth="1180px" height="560px" marginX="auto" />;
  },
};
export const ColumnManagement = {
  id: "components-data-display-data-table--column-management",
  decorators: [storyPage()],
  args: {
    data: columnManagementRows,
    initialPageSize: 10,
    pageSizeOptions: [10, 20, 30],
    selectionMode: "multiple",
    selectionActions,
    rowActions,
    compactHeaders,
    toolbarStorageKey: "preview-data-table-column-management",
  },
  render: (args: DataTableProps) => {
    return <DataTableStoryContainer args={args} maxWidth="1180px" height="560px" marginX="auto" />;
  },
};
