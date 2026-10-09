// Load the stored plan against current Planner tickets, save edits, and resolve CLI names to ids.
import type { CommandContext } from "@pstdio/sdk/extensions";
import { readTicketsCommand } from "../../commands/read-tickets";
import { readTicketStatuses } from "../../data/status-operations";
import { planChanged, type StoredPlan } from "../contracts";
import { resolvePlan } from "../model/resolve-plan";
import type { PlannerTicket } from "../planner";

const planKey = "timeline.plan";

export async function loadPlan(ctx: CommandContext) {
  const [tickets, statuses, stored] = await Promise.all([
    readTicketsCommand.run(ctx, {}),
    readTicketStatuses(ctx.storage),
    ctx.storage.get<StoredPlan>(planKey),
  ]);
  return { tickets, statuses: statuses.statuses, plan: resolvePlan(stored, tickets, statuses.statuses) };
}

export async function savePlan(ctx: CommandContext, plan: StoredPlan, reason: string) {
  await ctx.storage.set(planKey, plan);
  await ctx.events.emit(planChanged, { reason });
}

// The view passes ids; people on the CLI pass shorthands such as PS-32.
export function findTicket(tickets: PlannerTicket[], key: string) {
  const wanted = key.trim().toLowerCase();
  const ticket = tickets.find(({ id, shorthand }) => id === key || shorthand.toLowerCase() === wanted);
  if (!ticket) {
    throw new Error(`Unknown ticket "${key}".`);
  }

  return ticket;
}

// A deadline is named by its id, or on the CLI by its date.
export function findDeadlineId(plan: StoredPlan, key: string) {
  const matches = plan.deadlines.filter(({ id, date }) => id === key || date === key);
  if (matches.length !== 1) {
    throw new Error(
      matches.length ? `Several deadlines fall on ${key}; use the deadline id.` : `Unknown deadline "${key}".`,
    );
  }

  return matches[0].id;
}

// Moving a ticket also accepts "none", which removes its deadline.
export const deadlineOrNone = (plan: StoredPlan, key: string) => (key === "none" ? null : findDeadlineId(plan, key));
