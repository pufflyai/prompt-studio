// Load the stored plan against current Planner tickets, save edits, and resolve CLI names to ids.
import type { ExtensionContextBase, ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { readTickets } from "../../commands/read-tickets";
import { readTicketStatuses } from "../../data/status-operations";
import { readWorkflowStatuses, usableWorkflowStatuses } from "../../data/workflow-statuses";
import { plannerSchemaChanged } from "../../events";
import { planChanged, type StoredPlan } from "../contracts";
import { resolvePlan } from "../model/resolve-plan";

const planKey = "timeline.plan";
export const readStoredPlan = (storage: ExtensionStorageApi) => storage.get<StoredPlan>(planKey);

export async function loadPlan(ctx: Pick<ExtensionContextBase, "storage" | "settings" | "resources">) {
  const [tickets, statuses, stored, selections] = await Promise.all([
    readTickets(ctx),
    readTicketStatuses(ctx.storage),
    readStoredPlan(ctx.storage),
    readWorkflowStatuses(ctx),
  ]);
  const workflow = usableWorkflowStatuses(selections);
  return {
    tickets,
    workflow,
    statuses: statuses.statuses,
    plan: resolvePlan(stored, tickets, statuses.statuses, workflow),
  };
}

export const writeStoredPlan = (storage: ExtensionStorageApi, plan: StoredPlan) => storage.set(planKey, plan);

export async function savePlan(
  ctx: Pick<ExtensionContextBase, "storage" | "events" | "resources">,
  plan: StoredPlan,
  reason: string,
) {
  await writeStoredPlan(ctx.storage, plan);
  await ctx.events.emit(planChanged, { reason });
  if (reason === "deadline") await ctx.events.emit(plannerSchemaChanged, {});
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
