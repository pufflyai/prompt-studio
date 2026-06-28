import { commandRef, type ResourceAnchor } from "@pstdio/sdk/extensions";

// Public planner command surface the automations extension consumes. Typed
// command refs let us call them with `ctx.commands.execute(ref, { params })`
// while keeping the automation extension's boundary at the planner's public
// commands; no internal storage helpers are imported.

interface PlannerTicket {
  id: string;
  shorthand: string;
  statusId: string | null;
  tagIds?: string[];
  parentId?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PlannerStatus {
  id: string;
  name: string;
  sortOrder: number;
}

interface PlannerTagOption {
  id: string;
  name: string;
  sortOrder: number;
}

interface PlannerTag {
  id: string;
  name: string;
  sortOrder: number;
  options: PlannerTagOption[];
}

interface PlannerQueryRow {
  id: string;
  resource: ResourceAnchor;
  attributes: Record<string, unknown>;
}

interface PlannerQueryAttribute {
  id: string;
  type?: { kind: string };
}

interface PlannerQueryResult {
  rows: PlannerQueryRow[];
  attributes?: PlannerQueryAttribute[];
}

export interface WorkspaceActivityResult {
  active: boolean;
  sessions: Array<{
    id: string;
    title: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  }>;
}

export const queryTicketsRef = commandRef<Record<string, never>, PlannerQueryResult>("pstdio-planner.query-tickets");

export const setTicketAttributeRef = commandRef<
  { rowId: string; attributeId: string; value: string | string[] },
  PlannerTicket | null
>("pstdio-planner.set-ticket-attribute");

export const workspaceActivityRef = commandRef<{ workspaceId: string }, WorkspaceActivityResult>(
  "pstdio-planner.workspace-activity",
);

export const refineTicketRef = commandRef<{ ticket?: string; rowId?: string }, unknown>("pstdio-planner.refine-ticket");
export const implementTicketRef = commandRef<{ ticket?: string; rowId?: string }, unknown>(
  "pstdio-planner.implement-ticket",
);
export const runReviewRef = commandRef<{ workspaceId?: string; ticket?: string }, unknown>("pstdio-planner.runReview");
export const readTicketsRef = commandRef<Record<string, never>, PlannerTicket[]>("pstdio-planner.read-tickets");
export const readStatusesRef = commandRef<Record<string, never>, { statuses: PlannerStatus[] }>(
  "pstdio-planner.ticketStatus.read",
);
export const readTagsRef = commandRef<Record<string, never>, { tags: PlannerTag[] }>("pstdio-planner.ticketTag.read");

export type { PlannerStatus, PlannerTag, PlannerTagOption, PlannerTicket };
