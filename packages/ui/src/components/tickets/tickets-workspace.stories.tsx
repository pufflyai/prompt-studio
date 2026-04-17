import type { Meta, StoryObj } from "@storybook/react";
import { expect, fireEvent, userEvent, within } from "storybook/test";

import { SubGroupedWorkspaceWrapper, WorkspaceWrapper } from "./stories-fixtures";

const meta: Meta = {
  title: "Tickets/TicketsWorkspace",
  parameters: { layout: "fullscreen" },
};

export default meta;

type Story = StoryObj;

export const BoardView: Story = {
  render: () => <WorkspaceWrapper />,
};

export const EmptyState: Story = {
  render: () => <WorkspaceWrapper listOnly />,
};

const switchToListView = async (canvas: ReturnType<typeof within>) => {
  await userEvent.click(canvas.getByLabelText("Display settings"));
  await userEvent.click(within(document.body).getByText("List"));
};

export const SwitchView: Story = {
  render: () => <WorkspaceWrapper />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await switchToListView(canvas);
    await expect(canvas.getByText("Set up API authentication")).toBeInTheDocument();
  },
};

export const ListGroupCollapse: Story = {
  render: () => <WorkspaceWrapper />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await switchToListView(canvas);

    await expect(canvas.getByText("Set up API authentication")).toBeInTheDocument();

    const todoGroup = canvas.getByText(/^Todo \(\d+\)$/);
    const todoRow = todoGroup.closest("[data-selected]")?.parentElement ?? todoGroup.parentElement!;
    const todoToggle = todoRow.querySelector("[data-expanded]")!;

    await expect(todoToggle).toHaveAttribute("data-expanded", "true");
    await userEvent.click(todoGroup);
    await expect(canvas.queryByText("Set up API authentication")).not.toBeInTheDocument();
    await expect(todoToggle).not.toHaveAttribute("data-expanded");
    await expect(canvas.getByText("Build ticket list interactions")).toBeInTheDocument();

    await userEvent.click(canvas.getByText(/^Todo \(\d+\)$/));
    await expect(canvas.getByText("Set up API authentication")).toBeInTheDocument();
  },
};

export const DragAndDrop: Story = {
  render: () => <WorkspaceWrapper />,
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

const dragCard = (canvas: ReturnType<typeof within>, title: string, targetTestId: string) => {
  const card = canvas.getByText(title).closest("[draggable]")!;
  const target = canvas.getByTestId(targetTestId);
  const dataTransfer = new DataTransfer();
  fireEvent.dragStart(card, { dataTransfer });
  fireEvent.dragOver(target, { dataTransfer });
  fireEvent.drop(target, { dataTransfer });
  fireEvent.dragEnd(card, { dataTransfer });
};

export const EmptyColumnPersists: Story = {
  render: () => <WorkspaceWrapper />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    dragCard(canvas, "Write docs", "board-column-todo");
    dragCard(canvas, "Set up CI pipeline", "board-column-todo");
    dragCard(canvas, "Add keyboard shortcuts", "board-column-todo");
    await expect(canvas.getByTestId("board-column-done")).toBeInTheDocument();
  },
};

const openDisplayMenu = async (canvas: ReturnType<typeof within>) => {
  await userEvent.click(canvas.getByLabelText("Display settings"));
};

const selectGrouping = async (label: string) => {
  const body = within(document.body);
  await userEvent.click(body.getByText("Grouping").closest("div")!.querySelector("button")!);
  await userEvent.click(body.getByText(label));
};

export const BadgeColorUpdatesAfterDrag: Story = {
  render: () => <WorkspaceWrapper />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await openDisplayMenu(canvas);
    const body = within(document.body);
    await userEvent.click(body.getByText("Status"));
    await userEvent.keyboard("{Escape}");

    const card = canvas.getByText("Write docs").closest("[draggable]")!;
    const todoColumn = canvas.getByTestId("board-column-todo");
    const dataTransfer = new DataTransfer();
    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.dragOver(todoColumn, { dataTransfer });
    fireEvent.drop(todoColumn, { dataTransfer });
    fireEvent.dragEnd(card, { dataTransfer });

    const todoCol = canvas.getByTestId("board-column-todo");
    const movedCard = within(todoCol).getByText("Write docs").closest("[data-testid='ticket-card']")! as HTMLElement;
    const todoBadge = within(movedCard).getByText("todo");
    await expect(todoBadge).toBeInTheDocument();
    await expect(todoBadge).toHaveAttribute("data-palette", "gray");
  },
};

export const NoGroupingSingleColumn: Story = {
  render: () => <WorkspaceWrapper />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await openDisplayMenu(canvas);
    await selectGrouping("No grouping");
    await userEvent.keyboard("{Escape}");

    await expect(canvas.queryByTestId("board-column-todo")).not.toBeInTheDocument();
    await expect(canvas.queryByTestId("board-column-in_progress")).not.toBeInTheDocument();
    await expect(canvas.queryByTestId("board-column-done")).not.toBeInTheDocument();
    await expect(canvas.getByTestId("board-column-All")).toBeInTheDocument();

    const allColumn = canvas.getByTestId("board-column-All");
    await expect(within(allColumn).getByText("Set up API authentication")).toBeInTheDocument();
    await expect(within(allColumn).getByText("Write docs")).toBeInTheDocument();
  },
};

export const SubGroupingHiddenWhenNoGrouping: Story = {
  render: () => <WorkspaceWrapper />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await openDisplayMenu(canvas);
    const body = within(document.body);
    await expect(body.getByText("Sub-grouping")).toBeInTheDocument();

    await selectGrouping("No grouping");
    await expect(body.queryByText("Sub-grouping")).not.toBeInTheDocument();
  },
};

export const ChevronDirectClick: Story = {
  render: () => <WorkspaceWrapper />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await switchToListView(canvas);

    const toggles = canvas.getAllByRole("button", { name: /Collapse group/i });
    const firstToggle = toggles[0]!;
    await expect(firstToggle).toHaveAttribute("data-expanded", "true");

    await userEvent.click(firstToggle);

    const collapsedToggles = canvas.getAllByRole("button", { name: /Expand group/i });
    await expect(collapsedToggles[0]).not.toHaveAttribute("data-expanded");
  },
};

export const ListModeDraggable: Story = {
  render: () => <WorkspaceWrapper />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await switchToListView(canvas);

    const ticketRow = canvas.getByText("Set up API authentication").closest("[draggable='true']");
    await expect(ticketRow).toBeInTheDocument();

    const groupRow = canvas.getByText(/^Todo \(\d+\)$/).closest("[draggable='true']");
    await expect(groupRow).toBeNull();
  },
};

// Regression: sub-group rows must NOT be drop targets (only column groups)
export const ListDndSubGroupNotDropTarget: Story = {
  render: () => <SubGroupedWorkspaceWrapper />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Switch to list view and enable assignee sub-grouping
    await userEvent.click(canvas.getByLabelText("Display settings"));
    await userEvent.click(within(document.body).getByText("List"));

    await userEvent.click(canvas.getByLabelText("Display settings"));
    const body = within(document.body);
    // Set sub-grouping to Assignee
    await userEvent.click(body.getByText("Sub-grouping").closest("div")!.querySelector("button")!);
    await userEvent.click(body.getByText("Assignee"));
    await userEvent.keyboard("{Escape}");

    // Column groups (depth 0) should be draggable drop targets
    // Sub-group rows (depth 1, e.g. "Alex (N)") should NOT be draggable drop targets
    // Verify a ticket is draggable
    const ticketRow = canvas.getByText("Set up API authentication").closest("[draggable='true']");
    await expect(ticketRow).toBeInTheDocument();

    // Sub-group row should not have drop handlers (no draggable='true')
    // The sub-group text ("Alex" or "Sam") should appear
    const subGroupRow = canvas.getByText(/^Alex \(\d+\)$/);
    await expect(subGroupRow).toBeInTheDocument();
    // Sub-group rows should not be draggable
    await expect(subGroupRow.closest("[draggable='true']")).toBeNull();
  },
};
