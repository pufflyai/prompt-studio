import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useState } from "react";
import { expect, fireEvent, userEvent, within } from "storybook/test";
import { TicketsWorkspace } from "./tickets-workspace";
import type { GroupingField, WorkspaceTagDefinition, WorkspaceTicket } from "./types";
import { useTicketsWorkspaceStore } from "./use-workspace-store";

const tagDefinitions: WorkspaceTagDefinition[] = [
  {
    name: "component",
    label: "Component",
    options: [
      { value: "backend", label: "Backend", color: "blue", icon: "wrench" },
      { value: "frontend", label: "Frontend", color: "purple", icon: "sparkles" },
      { value: "devops", label: "DevOps", color: "orange", icon: "gauge" },
      { value: "docs", label: "Docs", color: "cyan", icon: "book-open" },
    ],
  },
  {
    name: "priority",
    label: "Priority",
    options: [
      { value: "high", label: "High", color: "red", icon: "alert-triangle" },
      { value: "medium", label: "Medium", color: "yellow", icon: "alert-triangle" },
      { value: "low", label: "Low", color: "green", icon: "flag" },
    ],
  },
];

const tickets: WorkspaceTicket[] = [
  {
    id: "1",
    ticketId: "PS-1",
    title: "Set up API authentication",
    status: "todo",
    statusColor: "gray",
    assignee: "Alex",
    tags: [
      { name: "component", value: "backend" },
      { name: "priority", value: "high" },
    ],
    updatedAt: "2026-03-15T12:00:00.000Z",
  },
  {
    id: "2",
    ticketId: "PS-2",
    title: "Build ticket list interactions",
    status: "in_progress",
    statusColor: "blue",
    assignee: "Sam",
    tags: [
      { name: "component", value: "frontend" },
      { name: "priority", value: "medium" },
    ],
    updatedAt: "2026-03-16T12:00:00.000Z",
  },
  {
    id: "3",
    ticketId: "PS-3",
    title: "Write docs",
    status: "done",
    statusColor: "green",
    assignee: "Taylor",
    tags: [{ name: "component", value: "docs" }],
    updatedAt: "2026-03-17T12:00:00.000Z",
  },
  {
    id: "4",
    ticketId: "PS-4",
    title: "Design database schema",
    status: "todo",
    statusColor: "gray",
    assignee: "Sam",
    tags: [
      { name: "component", value: "backend" },
      { name: "priority", value: "medium" },
    ],
    updatedAt: "2026-03-14T10:00:00.000Z",
  },
  {
    id: "5",
    ticketId: "PS-5",
    title: "Implement search filters",
    status: "in_progress",
    statusColor: "blue",
    assignee: "Alex",
    tags: [
      { name: "component", value: "frontend" },
      { name: "priority", value: "high" },
    ],
    updatedAt: "2026-03-18T08:00:00.000Z",
  },
  {
    id: "6",
    ticketId: "PS-6",
    title: "Set up CI pipeline",
    status: "done",
    statusColor: "green",
    assignee: "Jordan",
    tags: [{ name: "component", value: "devops" }],
    updatedAt: "2026-03-13T14:00:00.000Z",
  },
  {
    id: "7",
    ticketId: "PS-7",
    title: "Add error tracking integration",
    status: "todo",
    statusColor: "gray",
    assignee: "Jordan",
    tags: [
      { name: "component", value: "backend" },
      { name: "priority", value: "low" },
    ],
    updatedAt: "2026-03-12T09:00:00.000Z",
  },
  {
    id: "8",
    ticketId: "PS-8",
    title: "Create onboarding flow",
    status: "in_progress",
    statusColor: "blue",
    assignee: "Taylor",
    tags: [
      { name: "component", value: "frontend" },
      { name: "priority", value: "high" },
    ],
    updatedAt: "2026-03-19T11:00:00.000Z",
  },
  {
    id: "9",
    ticketId: "PS-9",
    title: "Write API rate limiting",
    status: "todo",
    statusColor: "gray",
    assignee: "Alex",
    tags: [
      { name: "component", value: "backend" },
      { name: "priority", value: "medium" },
    ],
    updatedAt: "2026-03-11T16:00:00.000Z",
  },
  {
    id: "10",
    ticketId: "PS-10",
    title: "Add keyboard shortcuts",
    status: "done",
    statusColor: "green",
    assignee: "Sam",
    tags: [
      { name: "component", value: "frontend" },
      { name: "priority", value: "low" },
    ],
    updatedAt: "2026-03-10T13:00:00.000Z",
  },
];

const meta: Meta = {
  title: "Tickets/TicketsWorkspace",
  parameters: { layout: "fullscreen" },
};

export default meta;

type Story = StoryObj;

const STORYBOOK_STORAGE_KEY = "storybook-workspace";

const applyGroupingValue = (ticket: WorkspaceTicket, grouping: GroupingField, value: string) => {
  if (grouping === "none") {
    return ticket;
  }

  if (grouping === "status") {
    return { ...ticket, status: value };
  }

  if (grouping === "assignee") {
    return { ...ticket, assignee: value };
  }

  const tagName = grouping.slice(4);
  const tags = ticket.tags ?? [];
  const nextTags = tags.some((tag) => tag.name === tagName)
    ? tags.map((tag) => (tag.name === tagName ? { ...tag, value } : tag))
    : [...tags, { name: tagName, value }];

  return { ...ticket, tags: nextTags };
};

const reorderTickets = (items: WorkspaceTicket[], ticketId: string, beforeTicketId?: string) => {
  const currentIndex = items.findIndex((ticket) => ticket.id === ticketId);
  if (currentIndex === -1) {
    return items;
  }

  const next = [...items];
  const [moved] = next.splice(currentIndex, 1);
  if (!moved) {
    return items;
  }

  if (!beforeTicketId) {
    next.push(moved);
    return next;
  }

  const beforeIndex = next.findIndex((ticket) => ticket.id === beforeTicketId);
  if (beforeIndex === -1) {
    next.push(moved);
    return next;
  }

  next.splice(beforeIndex, 0, moved);
  return next;
};

const WorkspaceWrapper = (props: {
  listOnly?: boolean;
  columnGrouping?: GroupingField;
  rowGrouping?: GroupingField;
}) => {
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [workspaceTickets, setWorkspaceTickets] = useState(tickets);
  const settings = useTicketsWorkspaceStore(STORYBOOK_STORAGE_KEY, (state) => state.settings);
  const reset = useTicketsWorkspaceStore(STORYBOOK_STORAGE_KEY, (state) => state.reset);
  const setColumnGrouping = useTicketsWorkspaceStore(STORYBOOK_STORAGE_KEY, (state) => state.setColumnGrouping);
  const setRowGrouping = useTicketsWorkspaceStore(STORYBOOK_STORAGE_KEY, (state) => state.setRowGrouping);

  useEffect(() => {
    reset();
    setColumnGrouping(props.columnGrouping ?? "status");
    setRowGrouping(props.rowGrouping ?? "none");
  }, [props.columnGrouping, props.rowGrouping, reset, setColumnGrouping, setRowGrouping]);

  const handleMoveTicket = (
    ticketId: string,
    targetColumnId: string,
    context?: { columnGrouping: GroupingField; beforeTicketId?: string },
  ) => {
    setWorkspaceTickets((current) => {
      const regrouped = current.map((ticket) =>
        ticket.id === ticketId ? applyGroupingValue(ticket, settings.columnGrouping, targetColumnId) : ticket,
      );

      return reorderTickets(regrouped, ticketId, context?.beforeTicketId);
    });
  };

  const handleMoveToGroup = (
    ticketId: string,
    targetGroupKey: string,
    context?: { rowGrouping: GroupingField; beforeTicketId?: string },
  ) => {
    const rowGrouping = context?.rowGrouping ?? settings.rowGrouping;
    if (rowGrouping === "none") return;

    setWorkspaceTickets((current) => {
      const regrouped = current.map((ticket) =>
        ticket.id === ticketId ? applyGroupingValue(ticket, rowGrouping, targetGroupKey) : ticket,
      );

      return reorderTickets(regrouped, ticketId, context?.beforeTicketId);
    });
  };

  const handleTagChange = (ticketId: string, tagName: string, newValue: string) => {
    setWorkspaceTickets((current) =>
      current.map((ticket) => {
        if (ticket.id !== ticketId) return ticket;
        const existing = ticket.tags ?? [];
        const hasTag = existing.some((tag) => tag.name === tagName);
        const tags = hasTag
          ? existing.map((tag) => (tag.name === tagName ? { ...tag, value: newValue } : tag))
          : [...existing, { name: tagName, value: newValue }];
        return { ...ticket, tags };
      }),
    );
  };

  return (
    <Box p="sm" height="560px">
      <TicketsWorkspace
        tickets={props.listOnly ? [] : workspaceTickets}
        storageKey={STORYBOOK_STORAGE_KEY}
        tagDefinitions={tagDefinitions}
        knownColumnKeys={["todo", "in_progress", "done"]}
        selectedTicketId={selectedTicketId}
        onTicketClick={(ticket) => setSelectedTicketId(ticket.id)}
        onMoveTicket={handleMoveTicket}
        onMoveToGroup={handleMoveToGroup}
        onTagChange={handleTagChange}
        getBoardColumnConfig={(groupKey) => ({
          color: groupKey === "done" ? "green" : groupKey === "in_progress" ? "blue" : "gray",
          canDragIn: true,
          canDragOut: true,
          canCreate: false,
          actions: [],
        })}
      />
    </Box>
  );
};

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

    // All groups are expanded by default — tickets are visible
    await expect(canvas.getByText("Set up API authentication")).toBeInTheDocument();

    // Click the "Todo" group to collapse — find its toggle icon
    const todoGroup = canvas.getByText("Todo");
    const todoRow = todoGroup.closest("[data-selected]")?.parentElement ?? todoGroup.parentElement!;
    const todoToggle = todoRow.querySelector("[data-expanded]")!;

    // Icon should show expanded state
    await expect(todoToggle).toHaveAttribute("data-expanded", "true");

    await userEvent.click(todoGroup);

    // Tickets in "Todo" should be hidden
    await expect(canvas.queryByText("Set up API authentication")).not.toBeInTheDocument();

    // Icon should show collapsed state
    await expect(todoToggle).not.toHaveAttribute("data-expanded");

    // Tickets in other groups should still be visible
    await expect(canvas.getByText("Build ticket list interactions")).toBeInTheDocument();

    // Click again to re-expand
    await userEvent.click(canvas.getByText("Todo"));
    await expect(canvas.getByText("Set up API authentication")).toBeInTheDocument();
  },
};

export const DragAndDrop: Story = {
  render: () => <WorkspaceWrapper />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // "Write docs" starts in the "done" column
    const doneColumn = canvas.getByTestId("board-column-done");
    await expect(within(doneColumn).getByText("Write docs")).toBeInTheDocument();

    // Drag it to the "todo" column
    const card = canvas.getByText("Write docs").closest("[draggable]")!;
    const todoColumn = canvas.getByTestId("board-column-todo");

    const dataTransfer = new DataTransfer();

    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.dragOver(todoColumn, { dataTransfer });
    fireEvent.drop(todoColumn, { dataTransfer });
    fireEvent.dragEnd(card, { dataTransfer });

    // "Write docs" should now be in the "todo" column
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

const dragCardToGroup = (canvas: ReturnType<typeof within>, title: string, columnId: string, groupKey: string) => {
  const card = canvas.getByText(title).closest("[draggable]")!;
  const target = document.querySelector(`[data-column-id="${columnId}"][data-group-key="${groupKey}"]`);

  if (!(target instanceof HTMLElement)) {
    throw new Error(`Expected group ${columnId}::${groupKey} to exist`);
  }

  const dataTransfer = new DataTransfer();
  fireEvent.dragStart(card, { dataTransfer });
  fireEvent.dragOver(target, { dataTransfer });
  fireEvent.drop(target, { dataTransfer });
  fireEvent.dragEnd(card, { dataTransfer });
};

const enableTagDisplay = async (canvas: ReturnType<typeof within>, tagLabel: string) => {
  await userEvent.click(canvas.getByLabelText("Display settings"));
  await userEvent.click(within(document.body).getByText(tagLabel));
};

export const InlineTagEdit: Story = {
  render: () => <WorkspaceWrapper />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Enable Component tag display
    await enableTagDisplay(canvas, "Component");

    // "Set up API authentication" in the "todo" column has component=backend
    const todoColumn = canvas.getByTestId("board-column-todo");
    const backendBadge = within(todoColumn).getAllByText("Backend")[0]!;

    // Click the badge to open the dropdown
    await userEvent.click(backendBadge);

    // Select "Frontend" from the dropdown
    const menuItems = within(document.body).getAllByText("Frontend");
    const dropdownItem = menuItems[menuItems.length - 1]!;
    await userEvent.click(dropdownItem);

    // The badge should now read "Frontend"
    const card = canvas.getByText("Set up API authentication").closest("[data-testid='ticket-card']");
    if (!(card instanceof HTMLElement)) {
      throw new Error("Expected ticket card element to exist");
    }
    await expect(within(card).getByText("Frontend")).toBeInTheDocument();
    await expect(within(card).queryByText("Backend")).not.toBeInTheDocument();
  },
};

export const EmptyColumnPersists: Story = {
  render: () => <WorkspaceWrapper />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Move all "done" tickets to "todo"
    dragCard(canvas, "Write docs", "board-column-todo");
    dragCard(canvas, "Set up CI pipeline", "board-column-todo");
    dragCard(canvas, "Add keyboard shortcuts", "board-column-todo");

    // The "done" column should still exist, just empty
    await expect(canvas.getByTestId("board-column-done")).toBeInTheDocument();
  },
};

export const SubgroupDragAndDrop: Story = {
  render: () => <WorkspaceWrapper columnGrouping="assignee" rowGrouping="status" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const ticketTitle = "Build ticket list interactions";

    dragCardToGroup(canvas, ticketTitle, "Alex", "in_progress");
    await expect(within(canvas.getByTestId("board-column-Alex")).getByText(ticketTitle)).toBeInTheDocument();
    await expect(within(canvas.getByTestId("board-column-Sam")).queryByText(ticketTitle)).not.toBeInTheDocument();

    dragCardToGroup(canvas, ticketTitle, "Alex", "todo");

    const alexInProgressGroup = document.querySelector('[data-column-id="Alex"][data-group-key="in_progress"]');
    const alexTodoGroup = document.querySelector('[data-column-id="Alex"][data-group-key="todo"]');

    if (!(alexInProgressGroup instanceof HTMLElement) || !(alexTodoGroup instanceof HTMLElement)) {
      throw new Error("Expected Alex subgroup containers to exist");
    }

    await expect(within(alexInProgressGroup).queryByText(ticketTitle)).not.toBeInTheDocument();
    await expect(within(alexTodoGroup).getByText(ticketTitle)).toBeInTheDocument();
  },
};
