// Share the execution plan's JSON shapes and events between commands and the browser view.

import { eventRef, type NavigationTargetPage } from "@pstdio/sdk/extensions";
import type { StoredStatus, StoredTag } from "../data/types";
import type { TicketAction } from "./model/action-types";
import type { TicketState } from "./model/state";

export const planChanged = eventRef<{ reason: string }>({
  extensionId: "pstdio.pstdio-planner",
  id: "timeline.plan.changed",
});

export const displayChanged = eventRef<{ reason: string }>({
  extensionId: "pstdio.pstdio-planner",
  id: "timeline.display.changed",
});

export interface Deadline {
  id: string;
  date: string;
  name?: string;
}

export interface PlanEntry {
  ticketId: string;
  deadlineId: string | null;
}

// Planner has no execution order or deadlines, so this extension owns them. The order of
// entries is the execution order, and each ticket is due by the deadline it belongs to.
export interface StoredPlan {
  deadlines: Deadline[];
  order: PlanEntry[];
}

export type PlanFlag = "overdue" | "due-soon" | "human-needed" | "blocked" | "waiting" | "out-of-order";

export interface PlanLink {
  id: string;
  shorthand: string;
  done: boolean;
}

export interface PlanRow {
  id: string;
  shorthand: string;
  title: string;
  status: string;
  state: TicketState;
  trackId: string | null;
  actions: TicketAction[];
  actionErrors: string[];
  instructions: string;
  done: boolean;
  // Position in the whole execution order, starting at 1.
  step: number;
  // Parent tickets from the root down to the direct parent.
  ancestors: PlanLink[];
  // Present when the ticket is an agent gate.
  gate?: true;
  deadlineId: string | null;
  dependsOn: PlanLink[];
  blocks: PlanLink[];
  // Open dependencies placed after this ticket in the execution order.
  laterDependencies: PlanLink[];
  blockedReason?: string;
  // Planner tag option ids, such as a feature area. Tracks group tickets by them.
  tagIds: string[];
  flags: PlanFlag[];
  target: NavigationTargetPage;
}

export interface PlanDeadline extends Deadline {
  daysLeft: number;
}

export interface PlanSection {
  deadline: PlanDeadline | null;
  rows: PlanRow[];
  counts: { total: number; done: number; humanNeeded: number; blocked: number; atRisk: number };
}

export type PlanTag = StoredTag;

export interface Plan {
  statuses: StoredStatus[];
  today: string;
  sections: PlanSection[];
  tags: PlanTag[];
  trackProperty?: PlanTag;
}

// How the timeline is shown. It is saved for the project so the view opens the way it was left.
export interface DisplaySettings {
  showDone: boolean;
  showCompletedPastDeadlines: boolean;
  attentionOnly: boolean;
  squareArrows: boolean;
}
