import type { StatusResponse, TagResponse } from "pstdio-api/dto";
import type {
  StatusAction,
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

const toActions = (status: StatusResponse): StatusAction[] => {
  const actions: StatusAction[] = [];
  if (status.can_create) actions.push("create_ticket");
  if (status.can_drag_in) actions.push("drag_in");
  if (status.can_drag_out) actions.push("drag_out");
  if (status.column_actions?.includes("archive_all")) actions.push("archive_all");
  return actions;
};

export const toTicketStatusOption = (status: StatusResponse): TicketStatusOption => {
  const columnActions: TicketColumnAction[] = status.column_actions?.includes("archive_all") ? ["archive_all"] : [];

  return {
    id: status.id,
    name: status.name,
    color: (status.color || DEFAULT_STATUS_COLOR) as TicketStatusColor,
    sortOrder: status.sort_order,
    isDefault: status.is_default,
    canDragOut: status.can_drag_out ?? true,
    canDragIn: status.can_drag_in ?? true,
    canCreate: status.can_create ?? status.is_default,
    columnActions,
    actions: toActions(status),
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
  sessionStatus: null,
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
  createdAt: ticket.created_at,
  title: ticket.display_title ?? "",
  content: "",
  tagIds: Array.isArray(ticket.tag_ids) ? ticket.tag_ids : [],
  status: ticket.status_name ?? statusById.get(ticket.status_id ?? "") ?? fallbackStatusName,
  statusColor: colorById.get(ticket.status_id ?? "") ?? fallbackColor,
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
  type: (tag.type ?? "single_select") as TicketTag["type"],
  options: Array.isArray(tag.options)
    ? tag.options.map((o) => ({
        id: o.id,
        name: o.name,
        color: (o.color || DEFAULT_STATUS_COLOR) as TicketStatusColor,
        sortOrder: o.sort_order,
        icon: o.icon ?? null,
        description: o.description ?? null,
      }))
    : [],
});
