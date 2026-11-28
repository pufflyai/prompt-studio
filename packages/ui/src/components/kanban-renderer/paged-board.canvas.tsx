import { Stack } from "@chakra-ui/react";
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
  attributes: { status: index < 175 ? "done" : "todo" },
}));
const PagedBoard = () => {
  const [loaded, setLoaded] = useState(100);
  const [onLoadMore] = useState(() => () => setLoaded((count) => Math.min(rows.length, count + 50)));
  return (
    <Stack height="600px">
      <KanbanRenderer
        storageKey="preview-paged-board"
        rows={rows.slice(0, loaded)}
        attributes={attributes}
        defaultSettings={{ viewMode: "board", columnGrouping: "status", rowGrouping: "none", displayProperties: [] }}
        page={{
          request: { limit: 50, offset: loaded - 50, search: "", fields: ["title", "status"] },
          result: {
            revision: "1",
            cursor: loaded < 250 ? String(loaded) : null,
            total: 250,
            filteredTotal: 250,
            groups: [
              { field: "status", value: "done", count: 175 },
              { field: "status", value: "todo", count: 75 },
            ],
          },
          loading: false,
          onLoadMore,
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
  title: "Design system/Patterns/Kanban renderer/Paged board",
  component: PagedBoard,
  fullscreen: true,
} satisfies CanvasMeta<typeof PagedBoard>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const UnloadedColumn: Story = {
  id: "patterns-kanban-renderer-paged-board--unloaded-column",
  description: "A visible empty column loads through successive pages. Scroll near the last card to continue.",
};
