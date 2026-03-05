import { useLiveQuery } from "@tanstack/react-db";
import { useState } from "react";

import { API_URL } from "@/features/api-url";
import { getCollection, type SyncedRow } from "@/features/sync/collections";
import { createTicket as apiCreateTicket } from "@/features/tickets/api/create-ticket";
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

const filterTickets = (tickets: TicketListItem[], searchQuery: string) => {
  let filtered = tickets.filter((t) => !t.archived && !t.draft);

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
  searchQuery: string,
): TicketFlatRow[] => {
  const filtered = filterTickets(tickets, searchQuery);
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

const toTicketListItem = (
  row: SyncedRow,
  statusMap: Map<string, SyncedRow>,
  tagAssignments: SyncedRow[],
  tagMap: Map<string, SyncedRow>,
): TicketListItem => {
  const status = row.status_id ? statusMap.get(row.status_id as string) : undefined;
  const assignedTagIds = tagAssignments.filter((a) => a.ticket_id === row.id).map((a) => a.ticket_tag_id as string);
  const tagNames = assignedTagIds.map((tid) => tagMap.get(tid)?.name as string).filter(Boolean);

  return {
    id: row.id,
    shorthand: row.shorthand as string,
    project_id: row.project_id as string,
    status_id: (row.status_id as string) ?? null,
    title: (row.title as string) ?? null,
    priority: (row.priority as string) ?? null,
    complexity: (row.complexity as string) ?? null,
    draft: row.draft as boolean,
    archived: row.archived as boolean,
    status_name: (status?.name as string) ?? null,
    tag_names: tagNames,
    created_at: row.created_at as string,
    parent_id: (row.parent_id as string) ?? null,
  };
};

export function useTickets(projectId: string | null) {
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [viewingTicket, setViewingTicket] = useState<TicketListItem | null>(null);

  const { data: rawTickets } = useLiveQuery(() => getCollection("tickets"));
  const { data: rawStatuses } = useLiveQuery(() => getCollection("ticket_statuses"));
  const { data: rawTags } = useLiveQuery(() => getCollection("ticket_tags"));
  const { data: rawTagAssignments } = useLiveQuery(() => getCollection("ticket_tag_assignments"));

  const statusMap = new Map((rawStatuses ?? []).map((s) => [s.id, s]));
  const tagMap = new Map((rawTags ?? []).map((t) => [t.id, t]));
  const tagAssignments = rawTagAssignments ?? [];

  const projectTickets = (rawTickets ?? []).filter((t) => t.project_id === projectId && !t.deleted_at);

  const tickets = projectTickets.map((t) => toTicketListItem(t, statusMap, tagAssignments, tagMap));

  const statuses: TicketStatus[] = (rawStatuses ?? [])
    .filter((s) => s.project_id === projectId)
    .map((s) => ({
      id: s.id,
      name: s.name as string,
      color: s.color as string,
      sort_order: s.sort_order as number,
      is_default: s.is_default as boolean,
    }));

  const flatRows = buildFlatRows(tickets, statuses, expanded, searchQuery);

  const toggleExpand = (ticketId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(ticketId)) next.delete(ticketId);
      else next.add(ticketId);
      return next;
    });
  };

  const createTicket = async (title: string, parentId?: string) => {
    if (!projectId) return;
    try {
      await apiCreateTicket(API_URL, { project_id: projectId, title, parent_id: parentId });
    } catch {
      setError("Failed to create ticket");
    }
  };

  const updateTicketStatus = async (ticketId: string, statusId: string) => {
    try {
      await apiUpdateTicket(API_URL, ticketId, { status_id: statusId });
    } catch {
      setError("Failed to update ticket");
    }
  };

  const toggleArchive = async (ticket: TicketListItem) => {
    try {
      await apiUpdateTicket(API_URL, ticket.id, { archived: !ticket.archived });
    } catch {
      setError("Failed to archive ticket");
    }
  };

  return {
    flatRows,
    statuses,
    expanded,
    error,
    searchQuery,
    viewingTicket,
    setSearchQuery,
    setViewingTicket,
    toggleExpand,
    createTicket,
    updateTicketStatus,
    toggleArchive,
  };
}
