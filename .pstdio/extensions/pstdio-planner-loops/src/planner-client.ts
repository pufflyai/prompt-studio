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
  automationPolicy: commandRef<Record<string, never>, { maxInProgress: number }>("pstdio-planner.automation-policy"),
  readTickets: commandRef<Record<string, never>, PlannerTicket[]>("pstdio-planner.read-tickets"),
  readStatuses: commandRef<Record<string, never>, { statuses: PlannerStatus[] }>("pstdio-planner.ticketStatus.read"),
  readTags: commandRef<Record<string, never>, { tags: PlannerTag[] }>("pstdio-planner.ticketTag.read"),
  getTicket: commandRef<{ id: string }, PlannerTicket | null>("pstdio-planner.get-ticket"),
  setTicketAttribute: commandRef<{ rowId: string; attributeId: string; value: string }, PlannerTicket | null>(
    "pstdio-planner.set-ticket-attribute",
  ),
  refineTicket: commandRef<{ ticket: string }, { id: string }>("pstdio-planner.refine-ticket"),
  runAttempt: commandRef<{ ticket: string }, { session: { id: string } }>("pstdio-planner.run-attempt"),
  runReview: commandRef<{ workspaceId: string; ticket?: string }, { id: string }>("pstdio-planner.runReview"),
  ticketWorkspaces: commandRef<{ id: string }, TicketWorkspaceRow[]>("pstdio-planner.ticket-workspaces"),
  workspaceActivity: commandRef<{ workspaceId: string }, WorkspaceActivity>("pstdio-planner.workspace-activity"),
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
