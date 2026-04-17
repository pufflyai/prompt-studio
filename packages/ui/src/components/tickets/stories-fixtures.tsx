import { Box } from "@chakra-ui/react";
import { useState } from "react";

import { TicketsWorkspace } from "./tickets-workspace";
import type { GroupingField, WorkspaceOption, WorkspaceTicket } from "./types";

export const tickets: WorkspaceTicket[] = [
  {
    id: "1",
    ticketId: "PS-1",
    title: "Set up API authentication",
    status: "todo",
    statusColor: "gray",
    labels: ["backend", "auth"],
    updatedAt: "2026-03-15T12:00:00.000Z",
  },
  {
    id: "2",
    ticketId: "PS-2",
    title: "Build ticket list interactions",
    status: "in_progress",
    statusColor: "blue",
    labels: ["frontend"],
    updatedAt: "2026-03-16T12:00:00.000Z",
  },
  {
    id: "3",
    ticketId: "PS-3",
    title: "Write docs",
    status: "done",
    statusColor: "green",
    labels: ["docs"],
    updatedAt: "2026-03-17T12:00:00.000Z",
  },
  {
    id: "4",
    ticketId: "PS-4",
    title: "Design database schema",
    status: "todo",
    statusColor: "gray",
    labels: ["backend", "database"],
    updatedAt: "2026-03-14T10:00:00.000Z",
  },
  {
    id: "5",
    ticketId: "PS-5",
    title: "Implement search filters",
    status: "in_progress",
    statusColor: "blue",
    labels: ["frontend", "search"],
    updatedAt: "2026-03-18T08:00:00.000Z",
  },
  {
    id: "6",
    ticketId: "PS-6",
    title: "Set up CI pipeline",
    status: "done",
    statusColor: "green",
    labels: ["devops"],
    updatedAt: "2026-03-13T14:00:00.000Z",
  },
  {
    id: "7",
    ticketId: "PS-7",
    title: "Add error tracking integration",
    status: "todo",
    statusColor: "gray",
    labels: ["backend", "observability"],
    updatedAt: "2026-03-12T09:00:00.000Z",
  },
  {
    id: "8",
    ticketId: "PS-8",
    title: "Create onboarding flow",
    status: "in_progress",
    statusColor: "blue",
    labels: ["frontend", "ux"],
    updatedAt: "2026-03-19T11:00:00.000Z",
  },
  {
    id: "9",
    ticketId: "PS-9",
    title: "Write API rate limiting",
    status: "todo",
    statusColor: "gray",
    labels: ["backend", "security"],
    updatedAt: "2026-03-11T16:00:00.000Z",
  },
  {
    id: "10",
    ticketId: "PS-10",
    title: "Add keyboard shortcuts",
    status: "done",
    statusColor: "green",
    labels: ["frontend", "ux"],
    updatedAt: "2026-03-10T13:00:00.000Z",
  },
];

// Tickets with assignee data for sub-grouping tests
export const ticketsWithAssignee: WorkspaceTicket[] = tickets.map((t) => ({
  ...t,
  assignee: ["Alex", "Sam"][Number(t.id) % 2],
}));

const GROUPING_OPTIONS_WITH_ASSIGNEE: WorkspaceOption<GroupingField>[] = [
  { value: "status", label: "Status" },
  { value: "assignee", label: "Assignee" },
  { value: "none", label: "No grouping" },
];

const STATUS_COLOR_MAP: Record<string, string> = { todo: "gray", in_progress: "blue", done: "green" };

export const WorkspaceWrapper = (props: { listOnly?: boolean }) => {
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [workspaceTickets, setWorkspaceTickets] = useState(tickets);

  const handleMoveTicket = (ticketId: string, targetColumnId: string) => {
    setWorkspaceTickets((current) =>
      current.map((ticket) =>
        ticket.id === ticketId
          ? { ...ticket, status: targetColumnId, statusColor: STATUS_COLOR_MAP[targetColumnId] ?? "gray" }
          : ticket,
      ),
    );
  };

  const handleReorderTicket = (ticketId: string, columnId: string, newIndex: number) => {
    setWorkspaceTickets((current) => {
      const columnTickets = current.filter((t) => t.status === columnId);
      const otherTickets = current.filter((t) => t.status !== columnId);
      const currentIndex = columnTickets.findIndex((t) => t.id === ticketId);
      if (currentIndex < 0) return current;
      const [item] = columnTickets.splice(currentIndex, 1);
      const adjustedIndex = newIndex > currentIndex ? newIndex - 1 : newIndex;
      columnTickets.splice(adjustedIndex, 0, item!);
      return [...otherTickets, ...columnTickets];
    });
  };

  return (
    <Box p="sm" height="560px">
      <TicketsWorkspace
        tickets={props.listOnly ? [] : workspaceTickets}
        storageKey="storybook-workspace"
        knownColumnKeys={["todo", "in_progress", "done"]}
        selectedTicketId={selectedTicketId}
        onTicketClick={(ticket) => setSelectedTicketId(ticket.id)}
        onMoveTicket={handleMoveTicket}
        onReorderTicket={handleReorderTicket}
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

export const SubGroupedWorkspaceWrapper = () => {
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [workspaceTickets, setWorkspaceTickets] = useState(ticketsWithAssignee);

  const handleMoveTicket = (ticketId: string, targetColumnId: string) => {
    setWorkspaceTickets((current) =>
      current.map((ticket) =>
        ticket.id === ticketId
          ? { ...ticket, status: targetColumnId, statusColor: STATUS_COLOR_MAP[targetColumnId] ?? "gray" }
          : ticket,
      ),
    );
  };

  return (
    <Box p="sm" height="560px">
      <TicketsWorkspace
        tickets={workspaceTickets}
        storageKey="storybook-subgrouped"
        knownColumnKeys={["todo", "in_progress", "done"]}
        groupingOptions={GROUPING_OPTIONS_WITH_ASSIGNEE}
        selectedTicketId={selectedTicketId}
        onTicketClick={(ticket) => setSelectedTicketId(ticket.id)}
        onMoveTicket={handleMoveTicket}
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
