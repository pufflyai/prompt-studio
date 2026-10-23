import { Button, Stack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
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
        storageKey="storybook-paged-board"
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
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof PagedBoard>;
export default meta;
type Story = StoryObj<typeof meta>;
export const UnloadedColumn: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const todo = within(canvas.getByTestId("board-column-todo"));
    const load = todo.getByRole("button", { name: "Load more cards" });
    await expect(todo.getByText("125", { exact: true })).toBeVisible();
    await expect(todo.queryByText(/hidden by search/)).not.toBeInTheDocument();
    load.focus();
    await userEvent.keyboard("{Enter}");
    await expect(load).toBeDisabled();
    await userEvent.click(canvas.getByRole("button", { name: "Finish read" }));
    await expect(await todo.findByText("Card 125")).toBeVisible();
  },
};
