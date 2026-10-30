import { Box } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { useState } from "react";
import { KanbanRenderer } from "./kanban-renderer";
import type { AttributeDescriptor, KanbanRendererRow } from "./types";

const meta: CanvasMeta = {
  title: "Patterns/Kanban Renderer/Dragging",
  tags: ["!manifest"],
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = CanvasVariant;
const attributes: AttributeDescriptor[] = [
  {
    id: "status",
    label: "Status",
    groupable: true,
    type: {
      kind: "enum",
      options: [
        { value: "todo", label: "Todo" },
        { value: "done", label: "Done" },
      ],
    },
  },
  {
    id: "team",
    label: "Team",
    groupable: true,
    type: {
      kind: "enum",
      options: [
        { value: "design", label: "Design" },
        { value: "product", label: "Product" },
      ],
    },
  },
];
const initialRows: KanbanRendererRow[] = [
  { id: "unknown", title: "Recover an unknown status", attributes: { status: "removed", team: "design" } },
  { id: "missing", title: "Assign a missing status", attributes: { status: null, team: "design" } },
  { id: "done", title: "Move a completed card", attributes: { status: "done", team: "product" } },
];
const DraggingBoard = (props: { grouped?: boolean; ungrouped?: boolean }) => {
  const { grouped = false, ungrouped = false } = props;
  const [rows, setRows] = useState(initialRows);
  return (
    <Box p="sm" height="560px">
      <KanbanRenderer
        rows={rows}
        attributes={attributes}
        storageKey={`storybook-kanban-dragging-${grouped}-${ungrouped}`}
        hideToolbar
        defaultSettings={{
          viewMode: "board",
          columnGrouping: ungrouped ? "none" : "status",
          rowGrouping: grouped ? "team" : "none",
          displayProperties: [],
        }}
        onMove={({ rowId, attributes: changes }) =>
          setRows((current) =>
            current.map((row) => (row.id === rowId ? { ...row, attributes: { ...row.attributes, ...changes } } : row)),
          )
        }
      />
    </Box>
  );
};
export const MissingAndUnknownStatus: Story = {
  id: "patterns-kanban-renderer-dragging--missing-and-unknown-status",
  render: () => <DraggingBoard />,
};
export const GroupedRows: Story = {
  id: "patterns-kanban-renderer-dragging--grouped-rows",
  render: () => <DraggingBoard grouped />,
};
export const UngroupedBoard: Story = {
  id: "patterns-kanban-renderer-dragging--ungrouped-board",
  render: () => <DraggingBoard ungrouped />,
};
