import { Badge, Box } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { useState } from "react";
import { AlertMessage } from "../primitives/alert";
import { KanbanRenderer } from "./kanban-renderer";
import { attributes, boardColumnColors, initialRows, type StoryRow } from "./kanban-renderer-story-fixtures";
import type { AttributeDescriptor } from "./types";

const meta: CanvasMeta<typeof KanbanRenderer> = {
  title: "Patterns/Kanban Renderer/Regression Cases",
  component: KanbanRenderer,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = CanvasVariant;
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
          displayProperties: ["status"],
        }}
        onAttributeChange={handleAttributeChange}
        getBoardColumnConfig={(groupKey) => ({
          color: boardColumnColors[groupKey] ?? "gray",
          canCreate: false,
        })}
      />
    </Box>
  );
};
export const EditableDisplayBadge: Story = {
  id: "patterns-kanban-renderer-regression-cases--editable-display-badge",
  tags: ["editable-display-badge-regression"],
  render: () => <EditableBadgeWrapper />,
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
  id: "patterns-kanban-renderer-regression-cases--clear-single-select-badge-by-repicking",
  tags: ["clearable-single-select-badge-regression"],
  render: () => <ClearableSingleSelectBadgeWrapper />,
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
          displayProperties: ["labels"],
        }}
        onAttributeChange={handleAttributeChange}
        getBoardColumnConfig={(groupKey) => ({
          color: boardColumnColors[groupKey] ?? "gray",
          canCreate: false,
        })}
      />
    </Box>
  );
};
export const EditableMultiSelectBadge: Story = {
  id: "patterns-kanban-renderer-regression-cases--editable-multi-select-badge",
  render: () => <EditableMultiSelectBadgeWrapper />,
};
interface CustomRendererRow extends StoryRow {
  attributes: StoryRow["attributes"] & {
    diffOverview: string;
  };
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
  id: "patterns-kanban-renderer-regression-cases--custom-attribute-renderer",
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
          displayProperties: ["diffOverview", "status"],
        }}
        defaultSorts={[{ attributeId: "updated", direction: "desc" }]}
      />
    </Box>
  ),
};
interface WorkspaceDisplayRow extends StoryRow {
  attributes: StoryRow["attributes"] & {
    workspace: string;
    workspaceItems: Array<{
      id: string;
      label: string;
      icon?: string;
    }>;
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
  id: "patterns-kanban-renderer-regression-cases--workspace-display-property",
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
          displayProperties: ["workspace", "priority"],
        }}
        defaultSorts={[{ attributeId: "updated", direction: "desc" }]}
      />
    </Box>
  ),
};
const FailedActionExample = () => {
  const [error, setError] = useState<string>();
  return (
    <Box p="sm" height="560px">
      {error ? <AlertMessage status="error" title={error} onClose={() => setError(undefined)} /> : null}
      <KanbanRenderer<StoryRow>
        rows={initialRows}
        attributes={attributes}
        storageKey="storybook-kanban-failed-action"
        defaultSettings={{ viewMode: "board", columnGrouping: "status", displayProperties: ["status"] }}
        onAttributeChange={async () => {
          throw new Error("Could not save the change.");
        }}
        onActionError={(error) => setError(error instanceof Error ? error.message : String(error))}
      />
    </Box>
  );
};
export const FailedAction: Story = {
  id: "patterns-kanban-renderer-regression-cases--failed-action",
  render: () => <FailedActionExample />,
};
