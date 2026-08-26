import { type CommandHelpersApi, type CommandRef, commandRef } from "@pstdio/sdk/extensions";

export interface PlannerTicket {
  id: string;
  shorthand: string;
  title: string;
  statusId: string | null;
  tagIds?: string[];
  draft?: boolean;
  createdAt: string;
  updatedAt: string;
  dependsOn?: string | string[] | null;
  parallelizable?: string | null;
}

export interface PlannerStatus {
  id: string;
  name: string;
  sortOrder: number;
}

export interface PlannerTagOption {
  id: string;
  name: string;
  sortOrder: number;
}

export interface PlannerTag {
  id: string;
  name: string;
  sortOrder: number;
  options: PlannerTagOption[];
}

export interface WorkspaceActivitySession {
  id: string;
  title: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PlannerAttempt {
  workspaceId: string;
  workspaceShorthand: string;
  ticketId: string;
  ticketShorthand: string;
  implementationSessionId: string;
  state: "implementing" | "review_ready" | "reviewing" | "approved" | "changes_requested" | "blocked" | "abandoned";
  revisions: Array<{
    revision: number;
    headSha: string;
    reviews: Array<{ id: string; sessionId: string | null; state: string }>;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceActivity {
  active: boolean;
  sessions: WorkspaceActivitySession[];
}

export interface TicketWorkspaceRow {
  id: string;
  workspace: string;
  branch: string;
  path: string;
  active: boolean;
}

// The planner's public command surface is the only boundary automation may
// cross; importing planner internals is forbidden.
export const planner = {
  automationPolicy: commandRef<Record<string, never>, { maxInProgress: number }>({
    extensionId: "pstdio.pstdio-planner",
    id: "automation-policy",
  }),
  readTickets: commandRef<Record<string, never>, PlannerTicket[]>({
    extensionId: "pstdio.pstdio-planner",
    id: "read-tickets",
  }),
  readStatuses: commandRef<Record<string, never>, { statuses: PlannerStatus[] }>({
    extensionId: "pstdio.pstdio-planner",
    id: "ticketStatus.read",
  }),
  readTags: commandRef<Record<string, never>, { tags: PlannerTag[] }>({
    extensionId: "pstdio.pstdio-planner",
    id: "ticketTag.read",
  }),
  getTicket: commandRef<{ id: string }, PlannerTicket | null>({
    extensionId: "pstdio.pstdio-planner",
    id: "get-ticket",
  }),
  setTicketAttribute: commandRef<{ rowId: string; attributeId: string; value: string }, PlannerTicket | null>({
    extensionId: "pstdio.pstdio-planner",
    id: "set-ticket-attribute",
  }),
  refineTicket: commandRef<{ ticket: string }, { id: string }>({
    extensionId: "pstdio.pstdio-planner",
    id: "refine-ticket",
  }),
  runAttempt: commandRef<
    { ticket: string },
    | { decision: "started"; attempt: PlannerAttempt; session: { id: string } }
    | { decision: "wait"; reason: string; dependencyIds: string[] }
  >({ extensionId: "pstdio.pstdio-planner", id: "run-attempt" }),
  runReview: commandRef<{ workspaceId: string }, { review: { id: string }; session: { id: string } }>({
    extensionId: "pstdio.pstdio-planner",
    id: "runReview",
  }),
  listAttempts: commandRef<Record<string, never>, PlannerAttempt[]>({
    extensionId: "pstdio.pstdio-planner",
    id: "list-attempts",
  }),
  reconcileAttempt: commandRef<{ workspaceId: string }, { decision: string; attempt: PlannerAttempt }>({
    extensionId: "pstdio.pstdio-planner",
    id: "reconcile-attempt",
  }),
  ticketWorkspaces: commandRef<{ id: string }, TicketWorkspaceRow[]>({
    extensionId: "pstdio.pstdio-planner",
    id: "ticket-workspaces",
  }),
  workspaceActivity: commandRef<{ workspaceId: string }, WorkspaceActivity>({
    extensionId: "pstdio.pstdio-planner",
    id: "workspace-activity",
  }),
};

export interface PlannerContext {
  commands: CommandHelpersApi;
}

export const executePlanner = async <TParams extends Record<string, unknown>, TResult>(
  ctx: PlannerContext,
  ref: CommandRef<TParams, TResult>,
  params: TParams,
) => {
  const outcome = await ctx.commands.execute(ref, { params });
  if (!outcome.ok) throw new Error(`${ref.id} failed: ${outcome.reason}`);
  return outcome.value;
};
