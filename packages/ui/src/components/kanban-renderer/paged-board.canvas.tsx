import { Button, Stack } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { KanbanRenderer } from "./kanban-renderer";
import type { AttributeDescriptor } from "./types";

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
];
const rows = Array.from({ length: 250 }, (_, index) => ({
  id: String(index),
  title: `Card ${index}`,
  attributes: { status: index < 125 ? "done" : "todo" },
}));
const PagedBoard = () => {
  const [loaded, setLoaded] = useState(100);
  const [loading, setLoading] = useState(false);
  return (
    <Stack height="600px">
      <Button
        onClick={() => {
          setLoaded(Math.min(250, loaded + 100));
          setLoading(false);
        }}
      >
        Finish read
      </Button>
      <KanbanRenderer
        storageKey="preview-paged-board"
        rows={rows.slice(0, loaded)}
        attributes={attributes}
        defaultSettings={{ viewMode: "board", columnGrouping: "status", rowGrouping: "none", displayProperties: [] }}
        page={{
          request: { limit: 100, offset: Math.max(0, loaded - 100), search: "", fields: ["title", "status"] },
          result: {
            revision: "1",
            cursor: loaded < 250 ? String(loaded) : null,
            total: 250,
            filteredTotal: 250,
            groups: [
              { field: "status", value: "done", count: 125 },
              { field: "status", value: "todo", count: 125 },
            ],
          },
          loading,
          onLoadMore: () => setLoading(true),
          onPageChange: () => {},
          onPageSizeChange: () => {},
          onSearchChange: () => {},
          onCollapsedGroupsChange: () => {},
        }}
      />
    </Stack>
  );
};
const meta = {
  title: "Patterns/Kanban Renderer/Paged board",
  component: PagedBoard,
  fullscreen: true,
} satisfies CanvasMeta<typeof PagedBoard>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const UnloadedColumn: Story = {
  id: "patterns-kanban-renderer-paged-board--unloaded-column",
};
