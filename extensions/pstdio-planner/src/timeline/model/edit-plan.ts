// Change the execution order and deadlines. Every edit takes a resolved plan and returns a new one.
import type { Deadline, StoredPlan } from "../contracts";
import { isDay } from "./days";
import { byDate } from "./resolve-plan";

export interface TicketMove {
  ticketId: string;
  deadlineId: string | null;
  // Place the ticket before this ticket in the same deadline, or at the end of the deadline when omitted.
  beforeId?: string;
}

function requireDeadline(plan: StoredPlan, deadlineId: string) {
  const deadline = plan.deadlines.find(({ id }) => id === deadlineId);
  if (!deadline) {
    throw new Error(`Unknown deadline "${deadlineId}".`);
  }

  return deadline;
}

function requireDate(date: string) {
  if (!isDay(date)) {
    throw new Error(`The deadline date must be written as YYYY-MM-DD, not "${date}".`);
  }

  return date;
}

export function moveTicket(plan: StoredPlan, move: TicketMove): StoredPlan {
  if (move.deadlineId) {
    requireDeadline(plan, move.deadlineId);
  }

  if (!plan.order.some(({ ticketId }) => ticketId === move.ticketId)) {
    throw new Error(`Unknown ticket "${move.ticketId}".`);
  }

  const order = plan.order.filter(({ ticketId }) => ticketId !== move.ticketId);
  order.splice(insertIndex(order, move), 0, { ticketId: move.ticketId, deadlineId: move.deadlineId });
  return { ...plan, order };
}

function insertIndex(order: StoredPlan["order"], move: TicketMove) {
  const before = order.findIndex(
    ({ ticketId, deadlineId }) => ticketId === move.beforeId && deadlineId === move.deadlineId,
  );
  if (before >= 0) {
    return before;
  }

  const last = order.findLastIndex(({ deadlineId }) => deadlineId === move.deadlineId);
  return last >= 0 ? last + 1 : order.length;
}

const named = (deadline: Deadline): Deadline => {
  const name = deadline.name?.trim();
  return { id: deadline.id, date: deadline.date, ...(name ? { name } : {}) };
};

export function addDeadline(plan: StoredPlan, deadline: Deadline): StoredPlan {
  requireDate(deadline.date);
  return { ...plan, deadlines: [...plan.deadlines, named(deadline)].sort(byDate) };
}

export function updateDeadline(
  plan: StoredPlan,
  deadlineId: string,
  change: { date?: string; name?: string },
): StoredPlan {
  const deadline = requireDeadline(plan, deadlineId);
  const updated = named({
    id: deadline.id,
    date: change.date === undefined ? deadline.date : requireDate(change.date),
    name: change.name ?? deadline.name,
  });
  return { ...plan, deadlines: plan.deadlines.map((item) => (item.id === deadlineId ? updated : item)).sort(byDate) };
}

export function removeDeadline(plan: StoredPlan, deadlineId: string): StoredPlan {
  requireDeadline(plan, deadlineId);
  return {
    deadlines: plan.deadlines.filter(({ id }) => id !== deadlineId),
    order: plan.order.map((entry) => (entry.deadlineId === deadlineId ? { ...entry, deadlineId: null } : entry)),
  };
}
