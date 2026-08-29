import { commandRef } from "@pstdio/sdk/extensions";

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

const plannerCommand = commandRef.forExtension({ publisher: "pstdio", name: "pstdio-planner" });

// This module owns the planner's public command contract. Consumers import these
// references instead of repeating the planner identity or command ids.
export const planner = {
  automationPolicy: plannerCommand<Record<string, never>, { maxInProgress: number }>("automation-policy"),
  readTickets: plannerCommand<Record<string, never>, PlannerTicket[]>("read-tickets"),
  readStatuses: plannerCommand<Record<string, never>, { statuses: PlannerStatus[] }>("ticket-status.read"),
  readTags: plannerCommand<Record<string, never>, { tags: PlannerTag[] }>("ticket-tag.read"),
  getTicket: plannerCommand<{ id: string }, PlannerTicket | null>("get-ticket"),
  setTicketAttribute: plannerCommand<{ rowId: string; attributeId: string; value: string }, PlannerTicket | null>(
    "set-ticket-attribute",
  ),
  refineTicket: plannerCommand<{ ticket: string }, { id: string }>("refine-ticket"),
  runAttempt: plannerCommand<
    { ticket: string },
    | { decision: "started"; attempt: PlannerAttempt; session: { id: string } }
    | { decision: "wait"; reason: string; dependencyIds: string[] }
  >("run-attempt"),
  runReview: plannerCommand<
    { workspaceId: string; expectedRevision?: number },
    { review: { id: string }; session: { id: string } }
  >("run-review"),
  listAttempts: plannerCommand<Record<string, never>, PlannerAttempt[]>("list-attempts"),
  reconcileAttempt: plannerCommand<{ workspaceId: string }, { decision: string; attempt: PlannerAttempt }>(
    "reconcile-attempt",
  ),
  ticketWorkspaces: plannerCommand<{ id: string }, TicketWorkspaceRow[]>("ticket-workspaces"),
  workspaceActivity: plannerCommand<{ workspaceId: string }, WorkspaceActivity>("workspace-activity"),
};
