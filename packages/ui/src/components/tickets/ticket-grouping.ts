import type { FilterCategory, FilterState, GroupingField, WorkspaceOrdering, WorkspaceTicket } from "./types";

interface GroupingOptions {
  columnGrouping: GroupingField;
  rowGrouping: GroupingField;
  knownColumnKeys?: string[];
}

interface TicketRowGroup {
  key: string;
  label: string;
  tickets: WorkspaceTicket[];
}

interface TicketColumnGroup {
  key: string;
  label: string;
  tickets: WorkspaceTicket[];
  rows: TicketRowGroup[];
}

const FALLBACK_LABELS: Record<Exclude<GroupingField, "none">, string> = {
  status: "No status",
  assignee: "Unassigned",
};

const normalize = (value: string | null | undefined, fallback: string) => {
  if (!value || value.trim() === "") {
    return fallback;
  }

  return value;
};

const getGroupingValue = (ticket: WorkspaceTicket, grouping: GroupingField) => {
  if (grouping === "none") {
    return "All";
  }

  if (grouping === "status") {
    return normalize(ticket.status, FALLBACK_LABELS.status);
  }

  return normalize(ticket.assignee, FALLBACK_LABELS.assignee);
};

const compareGroupKey = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

const orderByDirection = (value: number, direction: WorkspaceOrdering["direction"]) =>
  direction === "asc" ? value : value * -1;

export const orderTickets = (tickets: WorkspaceTicket[], ordering: WorkspaceOrdering) => {
  if (ordering.field === "manual") {
    return tickets;
  }

  return [...tickets].sort((a, b) => {
    if (ordering.field === "updated") {
      const left = new Date(a.updatedAt ?? 0).getTime();
      const right = new Date(b.updatedAt ?? 0).getTime();
      return orderByDirection(left - right, ordering.direction);
    }

    if (ordering.field === "title") {
      return orderByDirection(a.title.localeCompare(b.title), ordering.direction);
    }

    return orderByDirection(a.ticketId.localeCompare(b.ticketId, undefined, { numeric: true }), ordering.direction);
  });
};

export const groupTickets = (tickets: WorkspaceTicket[], options: GroupingOptions): TicketColumnGroup[] => {
  const { columnGrouping, rowGrouping, knownColumnKeys } = options;
  const groupedByColumn = new Map<string, WorkspaceTicket[]>();

  // Seed with known keys so empty columns are preserved
  if (knownColumnKeys) {
    for (const key of knownColumnKeys) {
      groupedByColumn.set(key, []);
    }
  }

  for (const ticket of tickets) {
    const key = getGroupingValue(ticket, columnGrouping);
    groupedByColumn.set(key, [...(groupedByColumn.get(key) ?? []), ticket]);
  }

  const columnEntries = [...groupedByColumn.entries()].sort(([left], [right]) => compareGroupKey(left, right));

  return columnEntries.map(([columnKey, columnTickets]) => {
    if (rowGrouping === "none") {
      return {
        key: columnKey,
        label: columnKey,
        tickets: columnTickets,
        rows: [],
      };
    }

    const groupedByRow = new Map<string, WorkspaceTicket[]>();

    for (const ticket of columnTickets) {
      const rowKey = getGroupingValue(ticket, rowGrouping);
      groupedByRow.set(rowKey, [...(groupedByRow.get(rowKey) ?? []), ticket]);
    }

    const rows = [...groupedByRow.entries()]
      .sort(([left], [right]) => compareGroupKey(left, right))
      .map(([rowKey, rowTickets]) => ({
        key: rowKey,
        label: rowKey,
        tickets: rowTickets,
      }));

    return {
      key: columnKey,
      label: columnKey,
      tickets: columnTickets,
      rows,
    };
  });
};

const getTicketFilterValues = (ticket: WorkspaceTicket, category: FilterCategory) => {
  if (category === "labels") {
    return ticket.labels ?? [];
  }

  if (category === "status") {
    return [normalize(ticket.status, FALLBACK_LABELS.status)];
  }

  return [normalize(ticket.assignee, FALLBACK_LABELS.assignee)];
};

export const filterTickets = (tickets: WorkspaceTicket[], filters: FilterState) => {
  const activeFilters = Object.entries(filters).filter(([, values]) => values && values.length > 0);

  if (activeFilters.length === 0) {
    return tickets;
  }

  return tickets.filter((ticket) =>
    activeFilters.every(([category, values]) => {
      const ticketValues = getTicketFilterValues(ticket, category as FilterCategory);
      return ticketValues.some((value) => values?.includes(value));
    }),
  );
};

export const countFilterValues = (tickets: WorkspaceTicket[], category: FilterCategory) => {
  const counts: Record<string, number> = {};

  for (const ticket of tickets) {
    for (const value of getTicketFilterValues(ticket, category)) {
      counts[value] = (counts[value] ?? 0) + 1;
    }
  }

  return counts;
};

export type { TicketColumnGroup, TicketRowGroup };
