import { Box, Button, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { Plus } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";
import { KanbanRenderer } from "./kanban-renderer";
import { attributes, initialRows, type StoryRow } from "./kanban-renderer-story-fixtures";
import type { KanbanRendererCreateSubmission, KanbanRendererSavedView, ViewMode } from "./types";
import { useKanbanRendererStore } from "./use-kanban-renderer-store";

const meta: Meta<typeof KanbanRenderer> = {
  title: "Patterns/Kanban Renderer/Kanban Renderer",
  component: KanbanRenderer,
  parameters: { layout: "fullscreen" },
};

export default meta;

type Story = StoryObj;

const STORYBOOK_STORAGE_KEY = "storybook-kanban-renderer";

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

const Wrapper = (props: {
  emptyState?: ReactNode;
  showEmptyState?: boolean;
  columnGrouping?: string;
  rowGrouping?: string;
  viewMode?: ViewMode;
  storageKey?: string;
  defaultViews?: KanbanRendererSavedView[];
  defaultActiveViewId?: string;
  withTicketMenu?: boolean;
}) => {
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [rows, setRows] = useState<StoryRow[]>(initialRows);
  const storageKey = props.storageKey ?? STORYBOOK_STORAGE_KEY;
  const defaultSettings = {
    viewMode: props.viewMode ?? "board",
    columnGrouping: props.columnGrouping ?? "status",
    rowGrouping: props.rowGrouping ?? "none",
  };
  const initialState = {
    settings: defaultSettings,
    views: props.defaultViews,
    activeViewId: props.defaultActiveViewId,
  };
  const reset = useKanbanRendererStore(storageKey, (state) => state.reset, initialState);

  useEffect(() => {
    reset();
  }, [reset]);

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
          color: groupKey === "done" ? "green" : groupKey === "in_progress" ? "blue" : "gray",
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

export const BoardView: Story = {
  render: () => <Wrapper />,
};

export const RendererChromeAndTicketMenu: Story = {
  tags: ["renderer-chrome-regression"],
  render: () => <Wrapper storageKey="storybook-kanban-renderer-chrome" withTicketMenu />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const renderer = canvas.getByTestId("kanban-renderer");
    const header = canvas.getByTestId("kanban-renderer-header");
    const firstCard = canvas.getAllByTestId("renderer-card")[0];
    if (!firstCard) throw new Error("Expected a ticket card to render");

    await expect(getComputedStyle(renderer).borderTopWidth).toBe("0px");
    await expect(getComputedStyle(header).backgroundColor).toBe("rgba(0, 0, 0, 0)");
    await expect(canvas.getAllByTestId("column-status-icon")[0]).toBeVisible();

    const filterButton = canvas.getByRole("button", { name: "Filter rows" });
    const displayButton = canvas.getByRole("button", { name: "Display settings" });
    const body = within(document.body);

    await userEvent.hover(filterButton);
    await expect(await body.findByRole("tooltip")).toHaveTextContent("Filter");
    await userEvent.unhover(filterButton);
    await waitFor(() => expect(body.queryByRole("tooltip")).not.toBeInTheDocument());

    await userEvent.hover(displayButton);
    await expect(await body.findByRole("tooltip")).toHaveTextContent("Display");
    await userEvent.unhover(displayButton);
    await waitFor(() => expect(body.queryByRole("tooltip")).not.toBeInTheDocument());

    fireEvent.contextMenu(firstCard);
    const menu = await body.findByRole("menu");
    await expect(menu.getBoundingClientRect().width).toBe(280);
  },
};

export const ListView: Story = {
  render: () => <Wrapper storageKey="storybook-kanban-renderer-list-view" viewMode="list" />,
};

const viewSettings = (viewMode: ViewMode, displayProperties: string[] = []) => ({
  viewMode,
  columnGrouping: "status",
  rowGrouping: "none",
  ordering: { attributeId: "manual", direction: "asc" } as const,
  displayProperties,
});

const SAVED_VIEWS: KanbanRendererSavedView[] = [
  {
    id: "all",
    title: "All",
    isDefault: true,
    settings: viewSettings("board", ["priority"]),
    filters: {},
  },
  {
    id: "my-work",
    title: "My work",
    settings: viewSettings("list", ["assignee", "priority"]),
    filters: { assignee: ["Alex"] },
  },
  {
    id: "design",
    title: "Design board",
    settings: viewSettings("board", ["component", "priority"]),
    filters: { component: ["frontend"] },
  },
  {
    id: "high-priority",
    title: "High priority",
    settings: viewSettings("board", ["assignee", "priority"]),
    filters: { priority: ["high"] },
  },
];

export const SavedViews: Story = {
  render: () => (
    <Wrapper storageKey="storybook-kanban-renderer-saved-views" defaultViews={SAVED_VIEWS} defaultActiveViewId="all" />
  ),
};

export const SavedFilteredView: Story = {
  tags: ["saved-filter-row-regression"],
  render: () => (
    <Wrapper
      storageKey="storybook-kanban-renderer-saved-filtered-view"
      defaultViews={SAVED_VIEWS}
      defaultActiveViewId="my-work"
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const filterPill = canvas.getByRole("button", { name: "Remove Assignee filter" }).parentElement;
    if (!filterPill) throw new Error("Expected the saved filter pill to render");

    await expect(within(filterPill).getByText("Assignee is")).toBeVisible();
    await expect(within(filterPill).getByText("Alex")).toBeVisible();
  },
};

const CreateFormWrapper = () => {
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
          ordering: { attributeId: "manual", direction: "asc" },
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

export const RendererOwnedCreateForm: Story = {
  render: () => <CreateFormWrapper />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(within(canvas.getByTestId("board-column-todo")).getByRole("button", { name: "Create row" }));
    const dialog = within(document.body).getByRole("dialog");
    await expect(within(dialog).getByText("Status · Todo")).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText("Description"), "Restore ticket creation");
    await userEvent.click(within(dialog).getByRole("button", { name: "Create ticket" }));
    await expect(
      within(canvas.getByTestId("board-column-todo")).getByText("Restore ticket creation"),
    ).toBeInTheDocument();
  },
};

export const EmptyState: Story = {
  render: () => <Wrapper showEmptyState />,
};

export const CustomEmptyState: Story = {
  render: () => (
    <Wrapper
      showEmptyState
      emptyState={
        <Stack height="100%" align="center" justify="center" gap="md" borderWidth="1px" borderRadius="md">
          <Stack gap="xs" textAlign="center">
            <Text textStyle="heading/S">No work queued</Text>
            <Text color="fg.muted" textStyle="body/S">
              Create a row to start tracking work in this view.
            </Text>
          </Stack>
          <Button size="sm">
            <Plus />
            Create row
          </Button>
        </Stack>
      }
    />
  ),
};

const switchToListView = async (canvas: ReturnType<typeof within>) => {
  await userEvent.click(canvas.getByLabelText("Display settings"));
  await userEvent.click(within(document.body).getByText("List"));
};

export const SwitchView: Story = {
  render: () => <Wrapper />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await switchToListView(canvas);
    await expect(canvas.getByText("Set up API authentication")).toBeInTheDocument();
  },
};

export const DragAndDrop: Story = {
  render: () => <Wrapper />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const doneColumn = canvas.getByTestId("board-column-done");
    await expect(within(doneColumn).getByText("Write docs")).toBeInTheDocument();

    const card = canvas.getByText("Write docs").closest("[draggable]")!;
    const todoColumn = canvas.getByTestId("board-column-todo");

    const dataTransfer = new DataTransfer();
    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.dragOver(todoColumn, { dataTransfer });
    fireEvent.drop(todoColumn, { dataTransfer });
    fireEvent.dragEnd(card, { dataTransfer });

    await expect(within(canvas.getByTestId("board-column-todo")).getByText("Write docs")).toBeInTheDocument();
    await expect(within(canvas.getByTestId("board-column-done")).queryByText("Write docs")).not.toBeInTheDocument();
  },
};

export const EmptyColumnPersists: Story = {
  render: () => <Wrapper />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const dragCard = (title: string, targetTestId: string) => {
      const card = canvas.getByText(title).closest("[draggable]")!;
      const target = canvas.getByTestId(targetTestId);
      const dataTransfer = new DataTransfer();
      fireEvent.dragStart(card, { dataTransfer });
      fireEvent.dragOver(target, { dataTransfer });
      fireEvent.drop(target, { dataTransfer });
      fireEvent.dragEnd(card, { dataTransfer });
    };

    dragCard("Write docs", "board-column-todo");
    dragCard("Set up CI pipeline", "board-column-todo");

    await expect(canvas.getByTestId("board-column-done")).toBeInTheDocument();
  },
};

export const MultiValuedLabels: Story = {
  render: () => <Wrapper />,
};
