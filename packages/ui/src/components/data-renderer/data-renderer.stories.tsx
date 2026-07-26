import { Badge, Box, Button, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { Plus } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { expect, fireEvent, userEvent, within } from "storybook/test";
import { DataRenderer } from "./data-renderer";
import { attributes, initialRows, type StoryRow } from "./data-renderer-story-fixtures";
import type { AttributeDescriptor, DataRendererCreateSubmission } from "./types";
import { useDataRendererStore } from "./use-data-renderer-store";

const meta: Meta<typeof DataRenderer> = {
  title: "Patterns/Data Renderer/Data Renderer",
  component: DataRenderer,
  parameters: { layout: "fullscreen" },
};

export default meta;

type Story = StoryObj;

const STORYBOOK_STORAGE_KEY = "storybook-data-renderer";

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
}) => {
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [rows, setRows] = useState<StoryRow[]>(initialRows);
  const reset = useDataRendererStore(STORYBOOK_STORAGE_KEY, (state) => state.reset);
  const setColumnGrouping = useDataRendererStore(STORYBOOK_STORAGE_KEY, (state) => state.setColumnGrouping);
  const setRowGrouping = useDataRendererStore(STORYBOOK_STORAGE_KEY, (state) => state.setRowGrouping);

  useEffect(() => {
    reset();
    setColumnGrouping(props.columnGrouping ?? "status");
    setRowGrouping(props.rowGrouping ?? "none");
  }, [props.columnGrouping, props.rowGrouping, reset, setColumnGrouping, setRowGrouping]);

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
      <DataRenderer<StoryRow>
        rows={props.showEmptyState ? [] : rows}
        storageKey={STORYBOOK_STORAGE_KEY}
        attributes={attributes}
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
      />
    </Box>
  );
};

export const BoardView: Story = {
  render: () => <Wrapper />,
};

const CreateFormWrapper = () => {
  const [rows, setRows] = useState<StoryRow[]>(initialRows);
  const createAttributes = attributes.map((attribute) =>
    ["status", "component", "priority", "labels"].includes(attribute.id) ? { ...attribute, editable: true } : attribute,
  );
  const createRow = (submission: DataRendererCreateSubmission) => {
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
      <DataRenderer<StoryRow>
        rows={rows}
        storageKey="storybook-data-renderer-create-form"
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

const EDITABLE_BADGE_STORAGE_KEY = "storybook-data-renderer-editable-badge";

const EditableBadgeWrapper = () => {
  const [rows, setRows] = useState<StoryRow[]>(initialRows);

  const handleAttributeChange = (rowId: string, attributeId: string, value: unknown) => {
    setRows((current) =>
      current.map((row) =>
        row.id === rowId ? { ...row, attributes: { ...row.attributes, [attributeId]: value } } : row,
      ),
    );
  };

  return (
    <Box p="sm" height="560px">
      <DataRenderer<StoryRow>
        rows={rows}
        storageKey={EDITABLE_BADGE_STORAGE_KEY}
        attributes={attributes}
        defaultSettings={{
          viewMode: "board",
          columnGrouping: "status",
          rowGrouping: "none",
          ordering: { attributeId: "manual", direction: "asc" },
          displayProperties: ["status"],
        }}
        onAttributeChange={handleAttributeChange}
        getBoardColumnConfig={(groupKey) => ({
          color: groupKey === "done" ? "green" : groupKey === "in_progress" ? "blue" : "gray",
          canDragIn: true,
          canDragOut: true,
          canCreate: false,
        })}
      />
    </Box>
  );
};

export const EditableDisplayBadge: Story = {
  tags: ["editable-display-badge-regression"],
  render: () => <EditableBadgeWrapper />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const todoColumn = canvas.getByTestId("board-column-todo");
    const doneColumn = canvas.getByTestId("board-column-done");
    const card = within(todoColumn).getByText("Set up API authentication").closest('[data-testid="renderer-card"]');

    if (!card) throw new Error("Expected the ticket card to render in the Todo column");

    await userEvent.click(within(card as HTMLElement).getByText("Todo"));
    await userEvent.click(within(document.body).getByRole("menuitem", { name: "Done" }));

    await expect(within(doneColumn).getByText("Set up API authentication")).toBeInTheDocument();
    await expect(within(todoColumn).queryByText("Set up API authentication")).not.toBeInTheDocument();
  },
};

const EditableMultiSelectBadgeWrapper = () => {
  const [rows, setRows] = useState<StoryRow[]>(initialRows);
  const editableAttributes = attributes.map((attribute) =>
    attribute.id === "labels" ? { ...attribute, editable: true } : attribute,
  );

  const handleAttributeChange = (rowId: string, attributeId: string, value: unknown) => {
    setRows((current) =>
      current.map((row) =>
        row.id === rowId ? { ...row, attributes: { ...row.attributes, [attributeId]: value } } : row,
      ),
    );
  };

  return (
    <Box p="sm" height="560px">
      <DataRenderer<StoryRow>
        rows={rows}
        storageKey="storybook-data-renderer-editable-multi-badge"
        attributes={editableAttributes}
        defaultSettings={{
          viewMode: "board",
          columnGrouping: "status",
          rowGrouping: "none",
          ordering: { attributeId: "manual", direction: "asc" },
          displayProperties: ["labels"],
        }}
        onAttributeChange={handleAttributeChange}
        getBoardColumnConfig={(groupKey) => ({
          color: groupKey === "done" ? "green" : groupKey === "in_progress" ? "blue" : "gray",
          canDragIn: true,
          canDragOut: true,
          canCreate: false,
        })}
      />
    </Box>
  );
};

export const EditableMultiSelectBadge: Story = {
  render: () => <EditableMultiSelectBadgeWrapper />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const todoColumn = canvas.getByTestId("board-column-todo");
    const card = within(todoColumn).getByText("Set up API authentication").closest('[data-testid="renderer-card"]');

    if (!card) throw new Error("Expected the ticket card to render in the Todo column");

    await userEvent.click(within(card as HTMLElement).getByText("Bug"));
    await userEvent.click(within(document.body).getByRole("menuitemcheckbox", { name: "Regression" }));

    await expect(within(document.body).getByRole("menuitemcheckbox", { name: "Bug" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(within(document.body).getByRole("menuitemcheckbox", { name: "Regression" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  },
};

interface CustomRendererRow extends StoryRow {
  attributes: StoryRow["attributes"] & { diffOverview: string };
}

const customRendererRows: CustomRendererRow[] = initialRows.slice(0, 4).map((row, index) => {
  const additions = [18, 4, 0, 27][index]!;
  const deletions = [3, 12, 0, 8][index]!;

  return {
    ...row,
    attributes: {
      ...row.attributes,
      diffOverview: `+${additions} -${deletions}`,
    },
  };
});

const customRendererAttributes: AttributeDescriptor[] = [
  ...attributes,
  {
    id: "diffOverview",
    label: "Diff",
    type: { kind: "string" },
    displayable: true,
    render: (value) => (
      <Badge variant="subtle" colorPalette="green" textStyle="label/XS/medium">
        {String(value)}
      </Badge>
    ),
  },
];

export const CustomAttributeRenderer: Story = {
  render: () => (
    <Box p="sm" height="560px">
      <DataRenderer<CustomRendererRow>
        rows={customRendererRows}
        storageKey="storybook-data-renderer-custom-attribute"
        attributes={customRendererAttributes}
        defaultSettings={{
          viewMode: "board",
          columnGrouping: "status",
          rowGrouping: "none",
          ordering: { attributeId: "updated", direction: "desc" },
          displayProperties: ["diffOverview", "status"],
        }}
      />
    </Box>
  ),
};

interface WorkspaceDisplayRow extends StoryRow {
  attributes: StoryRow["attributes"] & {
    workspace: string;
    workspaceItems: Array<{ id: string; name: string; shorthand?: string; type: "worktree" | "current_branch" }>;
  };
}

const workspaceDisplayAttributes: AttributeDescriptor[] = [
  ...attributes,
  {
    id: "workspace",
    label: "Workspace",
    type: { kind: "string" },
    displayable: true,
    display: { kind: "workspace-badge", itemsAttributeId: "workspaceItems" },
  },
];

const workspaceDisplayRows: WorkspaceDisplayRow[] = initialRows.slice(0, 4).map((row, index) => ({
  ...row,
  attributes: {
    ...row.attributes,
    workspace: `workspace-${index + 1}`,
    workspaceItems: [
      {
        id: `workspace-${index + 1}`,
        name: `${row.id}_A1`,
        shorthand: `${row.id}_A1`,
        type: index % 2 === 0 ? "worktree" : "current_branch",
      },
    ],
  },
}));

export const WorkspaceDisplayProperty: Story = {
  render: () => (
    <Box p="sm" height="560px">
      <DataRenderer<WorkspaceDisplayRow>
        rows={workspaceDisplayRows}
        storageKey="storybook-data-renderer-workspace-display"
        attributes={workspaceDisplayAttributes}
        defaultSettings={{
          viewMode: "board",
          columnGrouping: "status",
          rowGrouping: "none",
          ordering: { attributeId: "updated", direction: "desc" },
          displayProperties: ["workspace", "priority"],
        }}
      />
    </Box>
  ),
};
