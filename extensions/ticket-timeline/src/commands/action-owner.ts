// Check a request's ticket owner and clean up writes racing with ticket deletion.
import type { CommandContext } from "@pstdio/sdk/extensions";
import { callPlanner, planner } from "../planner";
import { readAction, requests, responses, type StoredAction } from "./action-store";

export async function ownedAction(ctx: CommandContext, ticket: string, actionId: string) {
  const current = await callPlanner(ctx, planner.getTicket, { id: ticket });
  if (!current || current.statusId === "done") {
    throw new Error("The ticket is removed or complete.");
  }
  const stored = await requests(ctx).get(actionId);
  if (!stored || stored.ticketId !== current.id) {
    throw new Error("The request was removed. Reload the ticket.");
  }
  return { stored, action: await readAction(ctx, stored) };
}

export async function keepOwnedAction(ctx: CommandContext, action: StoredAction) {
  if (await callPlanner(ctx, planner.getTicket, { id: action.ticketId })) {
    return;
  }
  await requests(ctx).delete(action.id);
  await responses(ctx).delete(action.id);
  throw new Error("The ticket was removed.");
}
