import type { PlannerStatus, PlannerTicket } from "../planner";

// Planner's workflow commands identify statuses by name; project status IDs are configurable.
export const workflowName = (name: string | undefined) => {
  const normalized = name?.trim().toLowerCase().replace(/\s+/g, "-");
  return normalized === "wip" ? "in-progress" : normalized;
};
export const completedStatusIds = (statuses: PlannerStatus[]) =>
  new Set(statuses.filter((status) => workflowName(status.name) === "done").map((status) => status.id));
export const isCompletedTicket = (ticket: PlannerTicket, statuses: PlannerStatus[]) =>
  completedStatusIds(statuses).has(ticket.statusId ?? "");
