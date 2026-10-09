// Complete the stored plan against current Planner tickets: drop removed ones and append new ones.
import type { Deadline, PlanEntry, StoredPlan } from "../contracts";
import { dependencyIds, type PlannerStatus, type PlannerTicket } from "../planner";
import { dependencyOrder } from "./dependency-order";
import { completedStatusIds } from "./workflow";

export const byDate = (left: Deadline, right: Deadline) =>
  left.date.localeCompare(right.date) || (left.name ?? "").localeCompare(right.name ?? "");

export function resolvePlan(stored: StoredPlan | undefined, tickets: PlannerTicket[], statuses: PlannerStatus[]) {
  const deadlines = [...(stored?.deadlines ?? [])].sort(byDate);
  const deadlineIds = new Set(deadlines.map(({ id }) => id));
  const known = new Set(tickets.map(({ id }) => id));
  const seen = new Set<string>();
  const order: PlanEntry[] = [];
  for (const entry of stored?.order ?? []) {
    if (known.has(entry.ticketId) && !seen.has(entry.ticketId)) {
      seen.add(entry.ticketId);
      order.push({
        ticketId: entry.ticketId,
        deadlineId: entry.deadlineId && deadlineIds.has(entry.deadlineId) ? entry.deadlineId : null,
      });
    }
  }

  // New tickets keep Planner's board order, with finished work first and dependencies before dependents.
  const added = tickets.filter(({ id }) => !seen.has(id));
  const doneIds = completedStatusIds(statuses);
  const finishedFirst = [
    ...added.filter(({ statusId }) => doneIds.has(statusId ?? "")),
    ...added.filter(({ statusId }) => !doneIds.has(statusId ?? "")),
  ];
  for (const ticket of dependencyOrder(
    finishedFirst,
    ({ id }) => id,
    ({ dependsOn }) => dependencyIds(dependsOn),
  )) {
    order.push({ ticketId: ticket.id, deadlineId: null });
  }

  return { deadlines, order };
}
