import { useCallback, useEffect, useState } from "react";

import { API_URL } from "@/features/api-url";
import { createTicket as apiCreateTicket } from "@/features/tickets/api/create-ticket";
import { listTicketStatuses } from "@/features/tickets/api/list-ticket-statuses";
import { listTickets } from "@/features/tickets/api/list-tickets";
import { updateTicket as apiUpdateTicket } from "@/features/tickets/api/update-ticket";

type TicketListItem = {
  id: string;
  shorthand: string;
  project_id: string;
  status_id: string | null;
  title: string | null;
  priority: string | null;
  complexity: string | null;
  draft: boolean;
  archived: boolean;
  status_name: string | null;
  tag_names: string[];
  created_at: string;
  parent_id?: string | null;
};

type TicketStatus = {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  is_default: boolean;
};

export type TicketFlatRow =
  | { type: "header"; statusName: string; statusColor: string }
  | { type: "ticket"; ticket: TicketListItem; depth: number; hasChildren: boolean };

const STATUS_FILTER_CYCLE = ["all", "backlog", "wip", "in_review", "done", "archived"] as const;

const filterTickets = (tickets: TicketListItem[], statusFilter: string | null, searchQuery: string) => {
  let filtered = tickets;

  if (statusFilter === "archived") {
    filtered = filtered.filter((t) => t.archived);
  } else {
    filtered = filtered.filter((t) => !t.archived && !t.draft);
  }

  if (statusFilter && statusFilter !== "all" && statusFilter !== "archived") {
    filtered = filtered.filter((t) => t.status_name === statusFilter);
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(
      (t) =>
        t.shorthand.toLowerCase().includes(q) ||
        (t.title ?? "").toLowerCase().includes(q) ||
        t.tag_names.some((tag) => tag.toLowerCase().includes(q)),
    );
  }

  return filtered;
};

const buildFlatRows = (
  tickets: TicketListItem[],
  statuses: TicketStatus[],
  expanded: Set<string>,
  statusFilter: string | null,
  searchQuery: string,
): TicketFlatRow[] => {
  const filtered = filterTickets(tickets, statusFilter, searchQuery);
  const rootTickets = filtered.filter((t) => !t.parent_id);
  const getChildren = (parentId: string) => tickets.filter((t) => t.parent_id === parentId);

  const sortedStatuses = [...statuses].sort((a, b) => a.sort_order - b.sort_order);
  const rows: TicketFlatRow[] = [];

  for (const status of sortedStatuses) {
    const group = rootTickets
      .filter((t) => t.status_id === status.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (group.length === 0) continue;

    rows.push({ type: "header", statusName: status.name, statusColor: status.color });

    for (const ticket of group) {
      const children = getChildren(ticket.id);
      rows.push({ type: "ticket", ticket, depth: 0, hasChildren: children.length > 0 });

      if (expanded.has(ticket.id) && children.length > 0) {
        for (const child of children) {
          rows.push({ type: "ticket", ticket: child, depth: 1, hasChildren: false });
        }
      }
    }
  }

  const noStatus = rootTickets.filter((t) => !t.status_id);
  if (noStatus.length > 0) {
    rows.push({ type: "header", statusName: "unassigned", statusColor: "gray" });
    for (const ticket of noStatus) {
      const children = getChildren(ticket.id);
      rows.push({ type: "ticket", ticket, depth: 0, hasChildren: children.length > 0 });
    }
  }

  return rows;
};

export function useTickets(projectId: string | null) {
  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [statuses, setStatuses] = useState<TicketStatus[]>([]);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewingTicket, setViewingTicket] = useState<TicketListItem | null>(null);

  const loadTickets = useCallback(async (pid: string) => {
    try {
      const items = await listTickets(API_URL, { project_id: pid });
      setTickets(items as TicketListItem[]);
      setError("");
    } catch {
      setError("Failed to load tickets");
    }
  }, []);

  const loadStatuses = useCallback(async (pid: string) => {
    try {
      const items = await listTicketStatuses(API_URL, pid);
      setStatuses(items);
    } catch {
      setError("Failed to load statuses");
    }
  }, []);

  useEffect(() => {
    if (!projectId) return;
    loadTickets(projectId);
    loadStatuses(projectId);
  }, [projectId, loadTickets, loadStatuses]);

  const flatRows = buildFlatRows(tickets, statuses, expanded, statusFilter, searchQuery);

  const toggleExpand = (ticketId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(ticketId)) next.delete(ticketId);
      else next.add(ticketId);
      return next;
    });
  };

  const cycleStatusFilter = () => {
    const currentIdx = STATUS_FILTER_CYCLE.indexOf((statusFilter ?? "all") as (typeof STATUS_FILTER_CYCLE)[number]);
    const nextIdx = (currentIdx + 1) % STATUS_FILTER_CYCLE.length;
    const next = STATUS_FILTER_CYCLE[nextIdx];
    setStatusFilter(next === "all" ? null : next!);
  };

  const createTicket = async (title: string, parentId?: string) => {
    if (!projectId) return;
    try {
      await apiCreateTicket(API_URL, { project_id: projectId, title, parent_id: parentId });
      await loadTickets(projectId);
    } catch {
      setError("Failed to create ticket");
    }
  };

  const updateTicketStatus = async (ticketId: string, statusId: string) => {
    try {
      await apiUpdateTicket(API_URL, ticketId, { status_id: statusId });
      if (projectId) await loadTickets(projectId);
    } catch {
      setError("Failed to update ticket");
    }
  };

  const toggleArchive = async (ticket: TicketListItem) => {
    try {
      // archived field is toggled via the API's draft field
      await apiUpdateTicket(API_URL, ticket.id, { draft: !ticket.archived });
      if (projectId) await loadTickets(projectId);
    } catch {
      setError("Failed to archive ticket");
    }
  };

  return {
    flatRows,
    statuses,
    expanded,
    error,
    statusFilter,
    searchQuery,
    viewingTicket,
    setSearchQuery,
    setViewingTicket,
    toggleExpand,
    cycleStatusFilter,
    createTicket,
    updateTicketStatus,
    toggleArchive,
  };
}
