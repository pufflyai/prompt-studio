import { Box } from "@chakra-ui/react";
import { type ReactNode, useState } from "react";
import { KanbanRenderer } from "./kanban-renderer";
import { attributes, initialRows, type StoryRow } from "./kanban-renderer-story-fixtures";
import type {
  KanbanRendererCreateSubmission,
  KanbanRendererSavedView,
  KanbanRendererViewsSource,
  ViewMode,
} from "./types";
import { useKanbanRendererStore } from "./use-kanban-renderer-store";

const STORYBOOK_STORAGE_KEY = "storybook-kanban-renderer";
const boardColumnColors: Record<string, string> = { done: "green", in_progress: "blue" };

const reorderRows = (items: StoryRow[], rowId: string, beforeRowId?: string) => {
  const currentIndex = items.findIndex((row) => row.id === rowId);
  if (currentIndex === -1) return items;

  const next = [...items];
  const [moved] = next.splice(currentIndex, 1);
  if (!moved) return items;

  if (!beforeRowId) {
    next.push(moved);
    return next;
  }

  const beforeIndex = next.findIndex((row) => row.id === beforeRowId);
  if (beforeIndex === -1) {
    next.push(moved);
    return next;
  }

  next.splice(beforeIndex, 0, moved);
  return next;
};

export const Wrapper = (props: {
  emptyState?: ReactNode;
  showEmptyState?: boolean;
  columnGrouping?: string;
  rowGrouping?: string;
  viewMode?: ViewMode;
  displayProperties?: string[];
  storageKey?: string;
  defaultViews?: KanbanRendererSavedView[];
  defaultActiveViewId?: string;
  withTicketMenu?: boolean;
  rows?: StoryRow[];
}) => {
  const [views, setViews] = useState(() =>
    (props.defaultViews ?? []).map((view, index) => ({ ...view, builtIn: index === 0 })),
  );
  const [defaultViewId, setDefaultViewId] = useState(props.defaultActiveViewId ?? views[0]?.id ?? "default");
  const viewsSource: KanbanRendererViewsSource | undefined = props.defaultViews
    ? {
        views,
        defaultViewId,
        onCreateView: async (input) => {
          const created = { ...input, id: crypto.randomUUID(), builtIn: false };
          setViews((current) => [...current, created]);
          return created;
        },
        onUpdateView: async (id, input) => {
          setViews((current) => current.map((view) => (view.id === id ? { ...view, ...input } : view)));
        },
        onDeleteView: async (id) => {
          setViews((current) => current.filter((view) => view.id !== id));
        },
        onSetDefaultView: async (id) => {
          setDefaultViewId(id ?? views[0].id);
        },
      }
    : undefined;
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [rows, setRows] = useState<StoryRow[]>(props.rows ?? initialRows);
  const storageKey = props.storageKey ?? STORYBOOK_STORAGE_KEY;
  const defaultSettings = {
    viewMode: props.viewMode ?? "board",
    columnGrouping: props.columnGrouping ?? "status",
    rowGrouping: props.rowGrouping ?? "none",
    displayProperties: props.displayProperties ?? [],
  };
  const initialState = {
    settings: defaultSettings,
  };
  const reset = useKanbanRendererStore(storageKey, (state) => state.reset, initialState);

  // Reset during the first render, before the renderer picks its first view in an effect.
  useState(reset);

  const handleAttributeChange = (rowId: string, attributeId: string, value: unknown) => {
    setRows((current) =>
      current.map((row) =>
        row.id === rowId ? { ...row, attributes: { ...row.attributes, [attributeId]: value } } : row,
      ),
    );
  };

  const handleReorder = (rowId: string, beforeRowId?: string) =>
    setRows((current) => reorderRows(current, rowId, beforeRowId) as StoryRow[]);

  return (
    <Box p="sm" height="560px">
      <KanbanRenderer<StoryRow>
        viewsSource={viewsSource}
        rows={props.showEmptyState ? [] : rows}
        storageKey={storageKey}
        attributes={attributes}
        defaultSettings={defaultSettings}
        defaultViews={props.defaultViews}
        defaultActiveViewId={props.defaultActiveViewId}
        selectedRowId={selectedRowId}
        emptyState={props.emptyState}
        onRowClick={(row) => setSelectedRowId(row.id)}
        onAttributeChange={handleAttributeChange}
        onReorder={handleReorder}
        getBoardColumnConfig={(groupKey) => ({
          color: boardColumnColors[groupKey] ?? "gray",
          canDragIn: true,
          canDragOut: true,
          canCreate: false,
        })}
        getRowContextMenuActions={
          props.withTicketMenu ? () => [{ key: "open", label: "Open ticket", onClick: () => undefined }] : undefined
        }
      />
    </Box>
  );
};

export const CreateFormWrapper = () => {
  const [rows, setRows] = useState<StoryRow[]>(initialRows);
  const createAttributes = attributes.map((attribute) =>
    ["status", "component", "priority", "labels"].includes(attribute.id) ? { ...attribute, editable: true } : attribute,
  );
  const createRow = (submission: KanbanRendererCreateSubmission) => {
    const content = String(submission.values.content);
    setRows((current) => [
      ...current,
      {
        id: `created-${current.length.toString()}`,
        title: content.split("\n")[0] || "Untitled",
        attributes: {
          status: submission.columnId,
          assignee: "",
          component: String(submission.attributeValues.component ?? ""),
          priority: String(submission.attributeValues.priority ?? ""),
          labels: submission.attributeValues.labels as string[],
          updated: new Date().toISOString(),
        },
      },
    ]);
  };

  return (
    <Box p="sm" height="560px">
      <KanbanRenderer<StoryRow>
        rows={rows}
        storageKey="storybook-kanban-renderer-create-form"
        attributes={createAttributes}
        defaultSettings={{
          viewMode: "board",
          columnGrouping: "status",
          rowGrouping: "none",
          displayProperties: ["priority", "labels"],
        }}
        createRow={{
          title: "New ticket",
          submitLabel: "Create ticket",
          fields: [
            {
              id: "content",
              label: "Description",
              placeholder: "Describe the ticket...",
              type: "markdown",
              required: true,
            },
            { id: "files", label: "Attach files", type: "files", multiple: true },
          ],
          labels: {
            cancel: "Cancel",
            properties: "Properties",
            submitError: "Could not create ticket",
            removeFile: "Remove file",
          },
        }}
        onCreateRow={createRow}
        getBoardColumnConfig={() => ({ canCreate: true })}
      />
    </Box>
  );
};
