import type { SyncedRow } from "@/features/sync/collections";
import type { TicketAttempt, TicketStatusColor } from "@/features/ticket-list/types";

const SESSION_STATUSES = ["in_progress", "awaiting_input", "completed", "failed", "cancelled"] as const;

const toSessionStatus = (value: unknown) => {
  if (typeof value !== "string") return null;
  if (SESSION_STATUSES.includes(value as (typeof SESSION_STATUSES)[number])) {
    return value as NonNullable<TicketAttempt["sessionStatus"]>;
  }
  return null;
};

export const toTicketFromRow = (
  row: SyncedRow,
  statusById: Map<string, string>,
  colorById: Map<string, TicketStatusColor>,
  fallbackName: string,
  fallbackColor: TicketStatusColor,
  tagIdsByTicket: Map<string, string[]>,
  workspacesByTicket: Map<string, SyncedRow[]>,
  sessionsByWorkspace: Map<string, SyncedRow>,
  subTicketsByParent: Map<string, SyncedRow[]>,
) => {
  const statusId = row.status_id as string | null;
  const sortedWorkspaces = (workspacesByTicket.get(row.id) ?? [])
    .filter((workspace) => !workspace.archived)
    .sort((a, b) => String(a.workspace_shorthand).localeCompare(String(b.workspace_shorthand)));
  const attempts = sortedWorkspaces.map((ws) => {
    const session = sessionsByWorkspace.get(ws.id);
    return {
      id: ws.id,
      label: (ws.name as string) ?? ws.id,
      attemptStatusId: (ws.attempt_status_id as string) ?? null,
      sessionStatus: toSessionStatus(session?.status),
      shorthand: (ws.workspace_shorthand as string) ?? ws.id,
      updatedAt: ws.updated_at as string,
      worktreePath: (ws.worktree_path as string) ?? null,
      setupError: (ws.setup_error as string) ?? null,
    };
  });

  const subTickets = (subTicketsByParent.get(row.id) ?? []).map((st) => ({
    id: st.id,
    shorthand: st.shorthand as string,
    title: (st.display_title as string) ?? "",
    statusId: (st.status_id as string) ?? null,
  }));

  return {
    id: row.id,
    shorthand: row.shorthand as string,
    createdAt: (row.created_at as string) ?? undefined,
    title: (row.display_title as string) ?? "",
    content: "",
    tagIds: tagIdsByTicket.get(row.id) ?? [],
    status: (row.status_name as string) ?? statusById.get(statusId ?? "") ?? fallbackName,
    statusColor: colorById.get(statusId ?? "") ?? fallbackColor,
    blockedReason: (row.blocked_reason as string) ?? null,
    dependsOn: (row.depends_on as string) ?? null,
    parentId: (row.parent_id as string) ?? null,
    archived: row.archived as boolean,
    draft: (row.draft as boolean) ?? false,
    deletedAt: (row.deleted_at as string) ?? null,
    assignee: null,
    updatedAt: row.updated_at as string,
    attempts,
    subTickets,
  };
};
