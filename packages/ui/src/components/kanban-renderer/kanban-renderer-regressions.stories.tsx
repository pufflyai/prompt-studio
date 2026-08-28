import { Badge, Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { KanbanRenderer } from "./kanban-renderer";
import { attributes, initialRows, type StoryRow } from "./kanban-renderer-story-fixtures";
import type { AttributeDescriptor } from "./types";

const meta: Meta<typeof KanbanRenderer> = {
  title: "Patterns/Kanban Renderer/Regression Cases",
  component: KanbanRenderer,
  parameters: { layout: "fullscreen" },
};

export default meta;

type Story = StoryObj;

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
      <KanbanRenderer<StoryRow>
        rows={rows}
        storageKey="storybook-kanban-renderer-editable-badge"
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

const ClearableSingleSelectBadgeWrapper = () => {
  const [rows, setRows] = useState<StoryRow[]>(initialRows);
  const editableAttributes = attributes.map((attribute) =>
    attribute.id === "priority" ? { ...attribute, editable: true } : attribute,
  );

  return (
    <Box p="sm" height="560px">
      <KanbanRenderer<StoryRow>
        rows={rows}
        storageKey="storybook-kanban-renderer-clearable-single-badge"
        attributes={editableAttributes}
        defaultSettings={{
          viewMode: "board",
          columnGrouping: "status",
          rowGrouping: "none",
          ordering: { attributeId: "manual", direction: "asc" },
          displayProperties: ["priority"],
        }}
        onAttributeChange={(rowId, attributeId, value) =>
          setRows((current) =>
            current.map((row) =>
              row.id === rowId ? { ...row, attributes: { ...row.attributes, [attributeId]: value } } : row,
            ),
          )
        }
      />
    </Box>
  );
};

export const ClearSingleSelectBadgeByRepicking: Story = {
  tags: ["clearable-single-select-badge-regression"],
  render: () => <ClearableSingleSelectBadgeWrapper />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const card = canvas.getByText("Set up API authentication").closest('[data-testid="renderer-card"]');
    if (!card) throw new Error("Expected the ticket card to render");

    await userEvent.click(within(card as HTMLElement).getByText("High"));
    await expect(within(document.body).queryByRole("menuitemradio", { name: "No Priority" })).not.toBeInTheDocument();
    await userEvent.click(within(document.body).getByRole("menuitemradio", { name: "High" }));
    await expect(within(card as HTMLElement).queryByText("High")).not.toBeInTheDocument();
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
      <KanbanRenderer<StoryRow>
        rows={rows}
        storageKey="storybook-kanban-renderer-editable-multi-badge"
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

    const tag = within(card as HTMLElement).getByText("Bug");
    await userEvent.hover(tag);
    await waitFor(() => expect(within(document.body).queryByRole("menu")).not.toBeInTheDocument());
    await userEvent.click(tag);
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

const customRendererRows: CustomRendererRow[] = initialRows.slice(0, 4).map((row, index) => ({
  ...row,
  attributes: {
    ...row.attributes,
    diffOverview: `+${[18, 4, 0, 27][index]!} -${[3, 12, 0, 8][index]!}`,
  },
}));

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
      <KanbanRenderer<CustomRendererRow>
        rows={customRendererRows}
        storageKey="storybook-kanban-renderer-custom-attribute"
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
    workspaceItems: Array<{ id: string; label: string; icon?: string }>;
  };
}

const workspaceDisplayAttributes: AttributeDescriptor[] = [
  ...attributes,
  {
    id: "workspace",
    label: "Workspace",
    type: { kind: "string" },
    displayable: true,
    display: { kind: "badge-list", itemsAttributeId: "workspaceItems" },
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
        label: `${row.id}_A1`,
        icon: index % 2 === 0 ? "GitBranch" : "GitCommit",
      },
    ],
  },
}));

export const WorkspaceDisplayProperty: Story = {
  render: () => (
    <Box p="sm" height="560px">
      <KanbanRenderer<WorkspaceDisplayRow>
        rows={workspaceDisplayRows}
        storageKey="storybook-kanban-renderer-workspace-display"
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
