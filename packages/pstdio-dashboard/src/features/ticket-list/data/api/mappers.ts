import type { StatusResponse, TagResponse } from "pstdio-api/dto";
import type {
  Ticket,
  TicketAttempt,
  TicketColumnAction,
  TicketStatusColor,
  TicketStatusOption,
  TicketTag,
} from "@/features/ticket-list/types";
import type { ApiTicket, ApiTicketAttempt } from "./types";

const DEFAULT_STATUS_COLOR: TicketStatusColor = "gray";
const DEFAULT_STATUS_NAME = "Unassigned";

const isWipLike = (name: string) => {
  const normalized = name.trim().toLowerCase();
  return normalized.includes("wip") || normalized.includes("progress");
};

const isClosedLike = (name: string) => {
  const normalized = name.trim().toLowerCase();
  return normalized === "done" || normalized === "closed" || normalized === "archived";
};

export const toTicketStatusOption = (status: StatusResponse): TicketStatusOption => {
  const columnActions: TicketColumnAction[] = isClosedLike(status.name) ? ["archive_all"] : [];

  return {
    id: status.id,
    name: status.name,
    color: (status.color || DEFAULT_STATUS_COLOR) as TicketStatusColor,
    sortOrder: status.sort_order,
    isDefault: status.is_default,
    canDragOut: true,
    canDragIn: true,
    canCreate: status.is_default,
    canAttemptOnDrop: isWipLike(status.name),
    columnActions,
  };
};

export const buildTicketStatusCatalog = (statuses: StatusResponse[]) => {
  const sorted = [...statuses].sort((a, b) => a.sort_order - b.sort_order);
  const options = sorted.map(toTicketStatusOption);
  const defaultStatus = options.find((status) => status.isDefault) ?? options[0];
  const fallbackName = defaultStatus?.name ?? DEFAULT_STATUS_NAME;
  const fallbackColor = defaultStatus?.color ?? DEFAULT_STATUS_COLOR;

  return {
    names: options.length ? options.map((status) => status.name) : [fallbackName],
    statusById: new Map(options.map((status) => [status.id, status.name])),
    idByName: new Map(options.map((status) => [status.name, status.id])),
    colorById: new Map(options.map((status) => [status.id, status.color])),
    fallbackName,
    fallbackColor,
    options,
  };
};

export const toTicketAttempt = (attempt: ApiTicketAttempt): TicketAttempt => ({
  id: attempt.id,
  label: attempt.label,
  status: attempt.status,
  shorthand: attempt.shorthand ?? attempt.id,
  sessionId: attempt.session_id,
  updatedAt: attempt.updated_at,
  worktreePath: attempt.worktree_path ?? null,
});

export const toTicket = (
  ticket: ApiTicket,
  statusById: Map<string, string>,
  colorById: Map<string, TicketStatusColor>,
  fallbackStatusName: string,
  fallbackColor: TicketStatusColor,
): Ticket => ({
  id: ticket.id,
  shorthand: ticket.shorthand,
  title: ticket.display_title ?? "",
  content: ticket.user_prompt ?? "",
  tagIds: Array.isArray(ticket.tag_ids) ? ticket.tag_ids : [],
  status: ticket.status_name ?? statusById.get(ticket.status_id ?? "") ?? fallbackStatusName,
  statusColor: colorById.get(ticket.status_id ?? "") ?? fallbackColor,
  complexity: ticket.complexity,
  blockedReason: ticket.blocked_reason ?? null,
  dependsOn: ticket.depends_on ?? null,
  parentId: ticket.parent_id ?? null,
  archived: ticket.archived,
  assignee: null,
  updatedAt: ticket.updated_at,
  attempts: Array.isArray(ticket.attempts) ? ticket.attempts.map(toTicketAttempt) : [],
  subTickets: Array.isArray(ticket.sub_tickets)
    ? ticket.sub_tickets.map((st) => ({
        id: st.id,
        shorthand: st.shorthand,
        title: st.title,
        statusId: st.status_id,
      }))
    : [],
});

export const toTicketTag = (tag: TagResponse): TicketTag => ({
  id: tag.id,
  name: tag.name,
  color: (tag.color || DEFAULT_STATUS_COLOR) as TicketStatusColor,
});
