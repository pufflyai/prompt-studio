import type { Ticket, TicketStatusOption } from "@/features/ticket-list/types";

import type { GroupingField, OrderingField, TicketGroup } from "../types";

const DISABLED_GROUP: Pick<TicketGroup, "canDragIn" | "canDragOut" | "canCreate" | "columnActions"> = {
  canDragIn: false,
  canDragOut: false,
  canCreate: false,
  columnActions: [],
};

export const groupTickets = (tickets: Ticket[], grouping: GroupingField, statusOptions: TicketStatusOption[]) => {
  switch (grouping) {
    case "status":
      return groupByStatus(tickets, statusOptions);
    case "assignee":
      return groupByAssignee(tickets);
    case "none":
      return [{ id: "all", label: "All Tickets", tickets, ...DISABLED_GROUP }];
  }
};

const groupByStatus = (tickets: Ticket[], statusOptions: TicketStatusOption[]): TicketGroup[] =>
  statusOptions.map((status) => ({
    id: status.name,
    label: status.name,
    color: status.color,
    tickets: tickets.filter((ticket) => ticket.status === status.name),
    canDragOut: status.canDragOut,
    canDragIn: status.canDragIn,
    canCreate: status.canCreate,
    columnActions: status.columnActions,
  }));

const groupByAssignee = (tickets: Ticket[]): TicketGroup[] => {
  const assignees = new Set<string>();

  for (const ticket of tickets) {
    if (ticket.assignee) {
      assignees.add(ticket.assignee);
    }
  }

  const groups: TicketGroup[] = [...assignees]
    .sort((a, b) => a.localeCompare(b))
    .map((assignee) => ({
      id: assignee,
      label: assignee,
      tickets: tickets.filter((t) => t.assignee === assignee),
      ...DISABLED_GROUP,
    }));

  const unassigned = tickets.filter((t) => !t.assignee);

  if (unassigned.length > 0) {
    groups.push({ id: "unassigned", label: "Unassigned", tickets: unassigned, ...DISABLED_GROUP });
  }

  return groups;
};

export const orderTickets = (tickets: Ticket[], ordering: OrderingField) => {
  if (ordering === "manual") {
    return [...tickets].sort((a, b) => {
      const createdAtDelta = new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
      if (createdAtDelta !== 0) {
        return createdAtDelta;
      }

      const shorthandDelta = a.shorthand.localeCompare(b.shorthand, undefined, { numeric: true });
      if (shorthandDelta !== 0) {
        return shorthandDelta;
      }

      return a.id.localeCompare(b.id);
    });
  }

  return [...tickets].sort(comparators[ordering]);
};

const comparators: Record<Exclude<OrderingField, "manual">, (a: Ticket, b: Ticket) => number> = {
  updated: (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  title: (a, b) => a.title.localeCompare(b.title),
  shorthand: (a, b) => a.shorthand.localeCompare(b.shorthand, undefined, { numeric: true }),
};
