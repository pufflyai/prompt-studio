// Load the stored plan against current Planner tickets, save edits, and resolve CLI names to ids.
import type { StoredPlan } from "../contracts";

// A deadline is named by its id, or on the CLI by its date.
export function findDeadlineId(plan: Pick<StoredPlan, "deadlines">, key: string) {
  const matches = plan.deadlines.filter(({ id, date }) => id === key || date === key);
  if (matches.length !== 1) {
    throw new Error(
      matches.length ? `Several deadlines fall on ${key}; use the deadline id.` : `Unknown deadline "${key}".`,
    );
  }

  return matches[0].id;
}

// Moving a ticket also accepts "none", which removes its deadline.
export const deadlineOrNone = (plan: Pick<StoredPlan, "deadlines">, key: string) =>
  key === "none" ? null : findDeadlineId(plan, key);
