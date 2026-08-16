import { Box, Button, Flex } from "@chakra-ui/react";
import { useState } from "react";
import { MarkdownEditor } from "@/components/rich-text/markdown-editor/markdown-editor";
import { MarkdownInline } from "@/components/rich-text/shared/markdown-inline";
import type { KanbanRendererSavedView } from "../kanban-renderer/types";
import { DataTable } from "./data-table";
import type { DataTableEditModeColumn, RowData } from "./types";

const editModeColumns: DataTableEditModeColumn[] = [
  { id: "name", label: "Name", alignment: "left" },
  { id: "role", label: "Role", alignment: "left" },
  { id: "status", label: "Status", alignment: "center" },
];

const initialRows: RowData[] = [
  { id: "person-1", name: "Avery Chen", role: "Designer", status: "Active" },
  { id: "person-2", name: "Sam Rivera", role: "Engineer", status: "Active" },
  { id: "person-3", name: "Jordan Lee", role: "Researcher", status: "Away" },
];

export const EditModeStory = () => {
  const [columns, setColumns] = useState(editModeColumns);
  const [data, setData] = useState(initialRows);

  const handleColumnsChange = (nextColumns: DataTableEditModeColumn[]) => {
    setColumns(nextColumns);
    setData((current) =>
      current.map((row) => ({
        id: row.id,
        ...Object.fromEntries(nextColumns.map((column) => [column.id, row[column.id] ?? ""])),
      })),
    );
  };

  return (
    <Box width="100%" maxWidth="64rem" marginX="auto">
      <DataTable
        data={data}
        editMode={{
          columns,
          onColumnsChange: handleColumnsChange,
          onDataChange: setData,
          isCellEditable: (context) => context.columnId !== "status",
        }}
        fullWidth
        getRowId={(row) => String(row.id)}
        isReadOnly={false}
      />
    </Box>
  );
};

export const ModeToggleStory = () => {
  const [columns, setColumns] = useState(editModeColumns);
  const [data, setData] = useState(initialRows);
  const [isEditing, setIsEditing] = useState(false);

  return (
    <Box width="100%" maxWidth="64rem" marginX="auto">
      <Flex justifyContent="flex-end" marginBottom="xs">
        <Button size="sm" variant="outline" onClick={() => setIsEditing((current) => !current)}>
          {isEditing ? "View mode" : "Edit mode"}
        </Button>
      </Flex>
      <DataTable
        data={data}
        editMode={{
          columns,
          onColumnsChange: setColumns,
          onDataChange: setData,
        }}
        fullWidth
        getRowId={(row) => String(row.id)}
        isReadOnly={!isEditing}
      />
    </Box>
  );
};

const richTextColumns: DataTableEditModeColumn[] = [
  { id: "topic", label: "Topic", alignment: "left" },
  { id: "summary", label: "Rich Markdown", alignment: "left" },
];

const richTextRows: RowData[] = [
  { id: "note-1", topic: "Formatting", summary: "**Bold content** with *emphasis* and `inline code`." },
  { id: "note-2", topic: "Links", summary: "Open the [Prompt Studio site](https://prompt.studio)." },
];

export const RichTextEditModeStory = () => {
  const [columns, setColumns] = useState(richTextColumns);
  const [data, setData] = useState(richTextRows);

  return (
    <Box width="100%" maxWidth="64rem" marginX="auto">
      <DataTable
        data={data}
        editMode={{
          columns,
          onColumnsChange: setColumns,
          onDataChange: setData,
          isCellEditable: (context) => context.columnId === "summary",
          renderHeader: (column) => <MarkdownInline value={column.label} />,
          renderCell: (context) => <MarkdownInline value={String(context.value ?? "")} />,
          renderCellEditor: ({ value, onChange }) => (
            <MarkdownEditor
              autoFocus
              defaultState={value}
              fullWidth
              isEditable
              padding="xs"
              scrollable={false}
              onChange={onChange}
            />
          ),
        }}
        fullWidth
        getRowId={(row) => String(row.id)}
        isReadOnly={false}
      />
    </Box>
  );
};

export const EditableSelectableRowsStory = () => {
  const [columns, setColumns] = useState(editModeColumns);
  const [data, setData] = useState(initialRows);

  return (
    <Box width="100%" maxWidth="64rem" marginX="auto">
      <DataTable
        data={data}
        editMode={{ columns, onColumnsChange: setColumns, onDataChange: setData }}
        fullWidth
        getRowId={(row) => String(row.id)}
        isReadOnly={false}
        selectionMode="multiple"
        selectionActions={[
          {
            label: "Delete selected",
            destructive: true,
            onSelect: (selectedRows) => {
              const selectedIds = new Set(selectedRows.map((row) => row.id));
              setData((current) => current.filter((row) => !selectedIds.has(row.id)));
            },
          },
        ]}
      />
    </Box>
  );
};

const editableViews: KanbanRendererSavedView[] = [
  {
    id: "all",
    title: "All",
    isDefault: true,
    settings: {
      viewMode: "list",
      columnGrouping: "none",
      rowGrouping: "none",
      ordering: { attributeId: "manual", direction: "asc" },
      displayProperties: [],
    },
    filters: {},
  },
  {
    id: "active",
    title: "Active",
    settings: {
      viewMode: "list",
      columnGrouping: "none",
      rowGrouping: "none",
      ordering: { attributeId: "manual", direction: "asc" },
      displayProperties: [],
    },
    filters: { status: ["Active"] },
  },
];

export const EditableWithViewsStory = () => {
  const [columns, setColumns] = useState(editModeColumns);
  const [data, setData] = useState(initialRows);

  return (
    <Box width="100%" maxWidth="64rem" marginX="auto">
      <DataTable
        data={data}
        defaultViews={editableViews}
        defaultActiveViewId="all"
        editMode={{ columns, onColumnsChange: setColumns, onDataChange: setData }}
        fullWidth
        getRowId={(row) => String(row.id)}
        isReadOnly={false}
        toolbarStorageKey="storybook-editable-data-table-with-views"
      />
    </Box>
  );
};
