import { Box, Button, Stack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { KanbanRendererBoard, type KanbanRendererBoardColumn } from "./kanban-renderer-board";

const meta: Meta = {
  title: "Patterns/Kanban Renderer/Column Scrolling",
  tags: ["!manifest", "ticket-column-scrollbar"],
};
export default meta;

const items = Array.from({ length: 40 }, (_, index) => ({
  id: `ticket-${index}`,
  cardProps: { title: `Ticket ${index + 1}. ${"A task with a longer title. ".repeat(index % 3)}` },
}));
const column: KanbanRendererBoardColumn = {
  id: "todo",
  label: "Todo",
  items,
  actions: [],
  canCreate: false,
};

const ColumnExample = (props: { count: number; grouped?: boolean }) => {
  const { count, grouped } = props;
  const [visibleCount, setVisibleCount] = useState(count);
  const visibleItems = items.slice(0, visibleCount);
  return (
    <Stack alignItems="start">
      <Button size="sm" onClick={() => setVisibleCount(1)}>
        Keep one card
      </Button>
      <Box data-testid="board-frame" height="lg" width="sm">
        <KanbanRendererBoard
          columns={[
            {
              ...column,
              items: visibleItems,
              groups: grouped ? [{ key: "priority", label: "High priority", items: visibleItems }] : undefined,
            },
          ]}
        />
      </Box>
    </Stack>
  );
};

const getColumnParts = (canvasElement: HTMLElement) => {
  const columnElement = within(canvasElement).getByTestId("board-column-todo");
  const viewport = columnElement.querySelector<HTMLElement>("[data-board-column-viewport]")!;
  const scrollbar = viewport.parentElement!.querySelector<HTMLElement>('[data-part="scrollbar"]')!;
  return { columnElement, viewport, scrollbar };
};

export const FittingCards: StoryObj = {
  render: () => <ColumnExample count={5} />,
  play: async ({ canvasElement }) => {
    const { viewport, scrollbar } = getColumnParts(canvasElement);
    await waitFor(() => expect(viewport.querySelectorAll("[data-index]")).toHaveLength(5));
    const frame = within(canvasElement).getByTestId("board-frame");
    const lastRow = viewport.querySelector<HTMLElement>('[data-index="4"]')!;
    await waitFor(() => expect(lastRow.offsetTop).toBeGreaterThan(0));
    const cardsHeight = lastRow.offsetTop + lastRow.getBoundingClientRect().height;
    frame.style.height = `${frame.clientHeight - viewport.clientHeight + cardsHeight + 4}px`;
    await waitFor(() => expect(viewport.clientHeight).toBeLessThan(cardsHeight + 10));
    await waitFor(() => expect(viewport.scrollHeight).toBe(viewport.clientHeight));
    await waitFor(() => expect(scrollbar).not.toBeVisible());
  },
};

export const OverflowingCards: StoryObj = {
  render: () => <ColumnExample count={40} />,
  play: async ({ canvasElement }) => {
    const { columnElement, viewport, scrollbar } = getColumnParts(canvasElement);
    await waitFor(() => expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight));
    await userEvent.hover(viewport);
    await waitFor(() => expect(scrollbar).toBeVisible());
    const innerRight = columnElement.getBoundingClientRect().right - columnElement.clientLeft;
    expect(Math.abs(scrollbar.getBoundingClientRect().right - innerRight)).toBeLessThan(1);
    viewport.scrollTop = viewport.scrollHeight;
    await waitFor(() =>
      expect(within(columnElement).getByRole("button", { name: items.at(-1)!.cardProps.title.trim() })).toBeVisible(),
    );
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Keep one card" }));
    await waitFor(() => expect(viewport.scrollHeight).toBe(viewport.clientHeight));
    await waitFor(() => expect(scrollbar).not.toBeVisible());
  },
};

export const GroupedCards: StoryObj = {
  render: () => <ColumnExample count={40} grouped />,
  play: async ({ canvasElement }) => {
    const { viewport, scrollbar } = getColumnParts(canvasElement);
    await waitFor(() => expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight));
    await userEvent.click(within(canvasElement).getByRole("button", { name: /High priority/ }));
    await waitFor(() => expect(viewport.scrollHeight).toBe(viewport.clientHeight));
    await waitFor(() => expect(scrollbar).not.toBeVisible());
  },
};
