import type { CommandExecuteResponse } from "@pstdio/sdk/api";
import type { SyncedRow } from "@/features/sync/collections";
import type {
  StatusAction,
  Ticket,
  TicketAttempt,
  TicketColumnAction,
  TicketStatusColor,
  TicketStatusOption,
  TicketTag,
} from "@/features/ticket-list/types";
import { apiRequest } from "@/lib/api";

export const PLANNER_COMMAND_PREFIX = "pstdio-planner.";

export interface PlannerTicketFile {
  id: string;
  name: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlannerTicketAttachment {
  id: string;
  name: string;
  mimeType: string | null;
  size: number;
  hash: string | null;
  url: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlannerTicket {
  id: string;
  shorthand: string;
  title: string;
  content: string;
  statusId: string | null;
  tagIds?: string[];
  attachments?: PlannerTicketAttachment[];
  files?: PlannerTicketFile[];
  parentId?: string | null;
  dependsOn?: string | null;
  blockedReason?: string | null;
  draft?: boolean;
  archived: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlannerStatus {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  isDefault: boolean;
  canCreate: boolean;
  canDragIn: boolean;
  canDragOut: boolean;
  columnActions: string[];
}

export interface PlannerTagOption {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  icon: string | null;
  description: string | null;
}

export interface PlannerTag {
  id: string;
  name: string;
  type: "single_select" | "multi_select";
  sortOrder: number;
  options: PlannerTagOption[];
}

export interface PlannerWorkspaceStatusDefinition {
  id: string;
  label: string;
  color?: string;
  icon?: string | null;
  sortOrder: number;
}

export interface PlannerWorkspaceStatusData {
  statuses: PlannerWorkspaceStatusDefinition[];
  valuesByWorkspaceId: Record<string, { status?: string; updatedAt: string }>;
}

interface PlannerStatusesResult {
  statuses: PlannerStatus[];
}

interface PlannerTagsResult {
  tags: PlannerTag[];
}

interface PlannerCommandOptions {
  signal?: AbortSignal;
  cache?: RequestCache;
}

export const executePlannerCommand = async <TValue>(
  projectId: string,
  commandName: string,
  params: Record<string, unknown> = {},
  options: PlannerCommandOptions = {},
) => {
  const commandId = commandName.startsWith(PLANNER_COMMAND_PREFIX)
    ? commandName
    : `${PLANNER_COMMAND_PREFIX}${commandName}`;
  const response = await apiRequest<CommandExecuteResponse>(
    `/v1/projects/${projectId}/extensions/commands/${encodeURIComponent(commandId)}/execute`,
    {
      method: "POST",
      body: { params },
      cache: options.cache,
      signal: options.signal,
    },
  );

  if (!response.outcome.ok) {
    throw new Error(
      response.outcome.reason ?? response.outcome.error?.message ?? `Planner command failed: ${commandId}`,
    );
  }

  return response.outcome.value as TValue;
};

const DEFAULT_STATUS_COLOR: TicketStatusColor = "gray";
const DEFAULT_STATUS_NAME = "Unassigned";

const isTicketStatusColor = (value: string): value is TicketStatusColor =>
  ["gray", "red", "orange", "yellow", "green", "teal", "blue", "cyan", "purple", "pink"].includes(value);

const toTicketStatusColor = (value: string | undefined) =>
  value && isTicketStatusColor(value) ? value : DEFAULT_STATUS_COLOR;

const toActions = (status: PlannerStatus): StatusAction[] => {
  const actions: StatusAction[] = [];
  if (status.canCreate) actions.push("create_ticket");
  if (status.canDragIn) actions.push("drag_in");
  if (status.canDragOut) actions.push("drag_out");
  if (status.columnActions.includes("archive_all")) actions.push("archive_all");
  return actions;
};

export const toTicketStatusOption = (status: PlannerStatus): TicketStatusOption => {
  const columnActions: TicketColumnAction[] = status.columnActions.includes("archive_all") ? ["archive_all"] : [];

  return {
    id: status.id,
    name: status.name,
    color: toTicketStatusColor(status.color),
    sortOrder: status.sortOrder,
    isDefault: status.isDefault,
    canDragOut: status.canDragOut,
    canDragIn: status.canDragIn,
    canCreate: status.canCreate,
    columnActions,
    actions: toActions(status),
  };
};

export const buildTicketStatusCatalog = (statuses: PlannerStatus[]) => {
  const options = [...statuses].sort((left, right) => left.sortOrder - right.sortOrder).map(toTicketStatusOption);
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

export const toTicketTag = (tag: PlannerTag): TicketTag => ({
  id: tag.id,
  name: tag.name,
  type: tag.type,
  options: [...tag.options]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((option) => ({
      id: option.id,
      name: option.name,
      color: toTicketStatusColor(option.color),
      sortOrder: option.sortOrder,
      icon: option.icon ?? null,
      description: option.description ?? null,
    })),
});

export const toTicket = (
  ticket: PlannerTicket,
  statusById: Map<string, string>,
  colorById: Map<string, TicketStatusColor>,
  fallbackStatusName: string,
  fallbackColor: TicketStatusColor,
): Ticket => ({
  id: ticket.id,
  shorthand: ticket.shorthand,
  createdAt: ticket.createdAt,
  title: ticket.title ?? "",
  content: "",
  tagIds: Array.isArray(ticket.tagIds) ? ticket.tagIds : [],
  status: statusById.get(ticket.statusId ?? "") ?? fallbackStatusName,
  statusColor: colorById.get(ticket.statusId ?? "") ?? fallbackColor,
  blockedReason: ticket.blockedReason ?? null,
  dependsOn: ticket.dependsOn ?? null,
  parentId: ticket.parentId ?? null,
  archived: ticket.archived,
  draft: ticket.draft ?? false,
  assignee: null,
  updatedAt: ticket.updatedAt,
  attempts: [],
  subTickets: [],
});

export const readPlannerTicketStatuses = async (projectId: string) => {
  const result = await executePlannerCommand<PlannerStatusesResult | PlannerStatus[]>(projectId, "ticketStatus.read");
  return Array.isArray(result) ? result : result.statuses;
};

export const readPlannerTicketTags = async (projectId: string) => {
  const result = await executePlannerCommand<PlannerTagsResult | PlannerTag[]>(projectId, "ticketTag.read");
  return Array.isArray(result) ? result : result.tags;
};

export const readPlannerWorkspaceStatuses = (projectId: string, workspaceIds: string[] = []) =>
  executePlannerCommand<PlannerWorkspaceStatusData>(projectId, "workspaceStatus.read", { workspaceIds });

export const readPlannerTicket = (projectId: string, ticketId: string, signal?: AbortSignal) =>
  executePlannerCommand<PlannerTicket | null>(projectId, "get-ticket", { id: ticketId }, { signal, cache: "no-store" });

export const readPlannerTickets = (projectId: string) =>
  executePlannerCommand<PlannerTicket[]>(projectId, "read-tickets");

const ticketShorthandFromWorkspaceShorthand = (workspaceShorthand: string | undefined) => {
  if (!workspaceShorthand) return null;
  const match = /^(.*)_A\d+$/.exec(workspaceShorthand);
  return match?.[1] ?? null;
};

const ticketShorthandFromAnchors = (anchors: unknown) => {
  if (!Array.isArray(anchors)) return null;
  const anchor = anchors.find((candidate) => {
    if (!candidate || typeof candidate !== "object") return false;
    return (candidate as { type?: unknown }).type === "ticket";
  }) as { label?: unknown; metadata?: Record<string, unknown> } | undefined;

  const shorthand = anchor?.metadata?.shorthand;
  if (typeof shorthand === "string") return shorthand;
  return typeof anchor?.label === "string" ? anchor.label : null;
};

export const ticketShorthandFromWorkspace = (workspace: SyncedRow) =>
  (workspace.ticket_shorthand as string | undefined) ??
  ticketShorthandFromAnchors(workspace.anchors_json) ??
  ticketShorthandFromWorkspaceShorthand(workspace.workspace_shorthand as string | undefined);

const SESSION_STATUSES = [
  "in_progress",
  "awaiting_input",
  "queued",
  "completed",
  "failed",
  "cancelled",
  "disconnected",
] as const;

const toSessionStatus = (value: unknown) => {
  if (typeof value !== "string") return null;
  if (SESSION_STATUSES.includes(value as (typeof SESSION_STATUSES)[number])) {
    return value as NonNullable<TicketAttempt["sessionStatus"]>;
  }
  return null;
};

export const toTicketAttemptFromWorkspace = (
  workspace: SyncedRow,
  sessionsByWorkspace: Map<string, SyncedRow>,
  workspaceStatusValues: PlannerWorkspaceStatusData["valuesByWorkspaceId"],
): TicketAttempt => {
  const session = sessionsByWorkspace.get(workspace.id);

  return {
    id: workspace.id,
    label: (workspace.name as string | undefined) ?? workspace.id,
    attemptStatusId: workspaceStatusValues[workspace.id]?.status ?? null,
    sessionStatus: toSessionStatus(session?.status),
    sessionCreatedAt:
      (session?.workspace_session_created_at as string | undefined) ??
      (session?.created_at as string | undefined) ??
      null,
    shorthand: (workspace.workspace_shorthand as string | undefined) ?? workspace.id,
    updatedAt: workspace.updated_at as string,
    worktreePath: (workspace.worktree_path as string | null | undefined) ?? null,
  };
};
