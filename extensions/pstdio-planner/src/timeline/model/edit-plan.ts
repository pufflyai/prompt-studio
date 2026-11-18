// Change the execution order and deadlines. Every edit takes a resolved plan and returns a new one.
import type { Deadline, StoredPlan } from "../contracts";
import { isDay } from "./days";
import { byDate } from "./resolve-plan";

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
