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
  withStoryPage,
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
  decorators: [withStoryPage],
  args: {
    data: tableRows,
    hiddenColumns: ["id"],
    columnIcons,
    toolbarStorageKey: "storybook-data-table-default",
  },
};
export default meta;
export const Default = {
  id: "components-data-display-data-table--default",
  render: (args: DataTableProps) => {
    return <DataTableStoryContainer args={args} maxWidth="960px" height="420px" marginX="auto" />;
  },
};
export const ColumnStats = {
  id: "components-data-display-data-table--column-stats",
  args: {
    data: generateTableRows(96),
    initialPageSize: 50,
    columnStats: {
      Invoice: { type: "unique" },
      Amount: { type: "histogram", bins: 12 },
      Status: { type: "top-values", limit: 2 },
      Region: { type: "top-values", limit: 2 },
    },
    toolbarStorageKey: "storybook-data-table-column-stats",
  },
  render: (args: DataTableProps) => {
    return <DataTableStoryContainer args={args} maxWidth="1180px" height="560px" marginX="auto" />;
  },
};
export const SingleValueStats = {
  id: "components-data-display-data-table--single-value-stats",
  args: {
    data: singleValueRows,
    initialPageSize: 20,
    columnStats: {
      Amount: { type: "histogram", bins: 8 },
      Status: { type: "top-values", limit: 3 },
    },
    toolbarStorageKey: "storybook-data-table-single-value-stats",
  },
  render: (args: DataTableProps) => {
    return <DataTableStoryContainer args={args} maxWidth="1080px" height="520px" marginX="auto" />;
  },
};
export const ColumnDescriptions = {
  id: "components-data-display-data-table--column-descriptions",
  args: {
    data: generateTableRows(24),
    columnDescriptions,
    toolbarStorageKey: "storybook-data-table-column-descriptions",
  },
  render: (args: DataTableProps) => (
    <DataTableStoryContainer args={args} maxWidth="1080px" height="480px" marginX="auto" />
  ),
};
export const FullHeight = {
  id: "components-data-display-data-table--full-height",
  args: {
    data: thousandTableRows,
    toolbarStorageKey: "storybook-data-table-full-height",
  },
  parameters: {
    pagePadding: 0,
    pageHeight: "100vh",
  },
  render: (args: DataTableProps) => {
    return <DataTableStoryContainer args={args} height="100%" />;
  },
};
export const Paginated = {
  id: "components-data-display-data-table--paginated",
  args: {
    data: generateTableRows(96),
    initialPageSize: 10,
    pageSizeOptions: [10, 20, 50],
    compactHeaders,
    toolbarStorageKey: "storybook-data-table-paginated",
  },
  render: (args: DataTableProps) => {
    return <DataTableStoryContainer args={args} maxWidth="1080px" height="520px" marginX="auto" />;
  },
};
export const SelectableRows = {
  id: "components-data-display-data-table--selectable-rows",
  args: {
    data: generateTableRows(48),
    initialPageSize: 10,
    selectionMode: "multiple",
    selectionActions,
    compactHeaders,
    toolbarStorageKey: "storybook-data-table-selectable-rows",
  },
  render: (args: DataTableProps) => {
    return <DataTableStoryContainer args={args} maxWidth="1080px" height="520px" marginX="auto" />;
  },
};
export const RowActions = {
  id: "components-data-display-data-table--row-actions",
  args: {
    data: generateTableRows(36),
    initialPageSize: 10,
    rowActions,
    compactHeaders,
    toolbarStorageKey: "storybook-data-table-row-actions",
  },
  render: (args: DataTableProps) => {
    return <DataTableStoryContainer args={args} maxWidth="1080px" height="520px" marginX="auto" />;
  },
};
export const DynamicRowActions = {
  id: "components-data-display-data-table--dynamic-row-actions",
  args: {
    data: [
      { Invoice: "INV-001", Status: "Open" },
      { Invoice: "INV-002", Status: "Archived" },
    ],
    getRowActions: (row: RowData) => (row.Status === "Archived" ? [] : rowActions),
    compactHeaders,
    toolbarStorageKey: "storybook-data-table-dynamic-row-actions",
  },
  render: (args: DataTableProps) => {
    return <DataTableStoryContainer args={args} maxWidth="1080px" height="520px" marginX="auto" />;
  },
};
export const RowActivation = {
  id: "components-data-display-data-table--row-activation",
  args: {
    data: generateTableRows(36),
    initialPageSize: 10,
    compactHeaders,
    enableRowActivation: true,
    toolbarStorageKey: "storybook-data-table-row-activation",
  },
  render: (args: DataTableProps) => {
    return <DataTableStoryContainer args={args} maxWidth="1080px" height="520px" marginX="auto" />;
  },
};
export const EditMode = {
  id: "components-data-display-data-table--edit-mode",
  render: () => <EditModeStory />,
};
export const RichTextEditMode = {
  id: "components-data-display-data-table--rich-text-edit-mode",
  render: () => <RichTextEditModeStory />,
};
export const ModeToggle = {
  id: "components-data-display-data-table--mode-toggle",
  render: () => <ModeToggleStory />,
};
export const EditableSelectableRows = {
  id: "components-data-display-data-table--editable-selectable-rows",
  render: () => <EditableSelectableRowsStory />,
};
export const EditableWithViews = {
  id: "components-data-display-data-table--editable-with-views",
  render: () => <EditableWithViewsStory />,
};
export const TagRichRows = {
  id: "components-data-display-data-table--tag-rich-rows",
  args: {
    data: generateTableRows(48),
    initialPageSize: 10,
    pageSizeOptions: [10, 20, 30],
    selectionMode: "multiple",
    selectionActions,
    rowActions,
    compactHeaders,
    toolbarStorageKey: "storybook-data-table-tag-rich-rows",
  },
  render: (args: DataTableProps) => {
    return <DataTableStoryContainer args={args} maxWidth="1180px" height="560px" marginX="auto" />;
  },
};
export const ColumnManagement = {
  id: "components-data-display-data-table--column-management",
  args: {
    data: columnManagementRows,
    initialPageSize: 10,
    pageSizeOptions: [10, 20, 30],
    selectionMode: "multiple",
    selectionActions,
    rowActions,
    compactHeaders,
    toolbarStorageKey: "storybook-data-table-column-management",
  },
  render: (args: DataTableProps) => {
    return <DataTableStoryContainer args={args} maxWidth="1180px" height="560px" marginX="auto" />;
  },
};
