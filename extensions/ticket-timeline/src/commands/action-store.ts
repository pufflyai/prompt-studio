// Own immutable requests and atomically save one terminal outcome per request.
import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import type { HumanAction, TicketAction } from "../model/action-types";
import { parseAction } from "../model/actions";

export type StoredAction = HumanAction & { ticketId: string };
export type ActionContext = Pick<ExtensionContextBase, "storage">;
export type ActionOutcome =
  | { kind: "resolved"; resolution: NonNullable<HumanAction["resolution"]> }
  | { kind: "cancelled"; cancellation: NonNullable<HumanAction["cancellation"]> };

export const requests = (ctx: ActionContext) => ctx.storage.collection<StoredAction>("action-requests");
export const responses = (ctx: ActionContext) => ctx.storage.collection<ActionOutcome>("action-outcomes");

export async function readAction(ctx: ActionContext, stored: StoredAction) {
  const outcome = await responses(ctx).get(stored.id);
  return parseAction(
    JSON.stringify({
      ...stored,
      ...(outcome?.kind === "resolved" ? { resolution: outcome.resolution } : {}),
      ...(outcome?.kind === "cancelled" ? { cancellation: outcome.cancellation } : {}),
    }),
  );
}

export async function readActionStore(ctx: ActionContext) {
  const result = new Map<string, { actions: TicketAction[]; errors: string[] }>();
  for (const stored of await requests(ctx).list()) {
    const group = result.get(stored.ticketId) ?? { actions: [], errors: [] };
    result.set(stored.ticketId, group);
    try {
      group.actions.push(await readAction(ctx, stored));
    } catch (reason) {
      group.errors.push(`Action ${stored.id}: ${String(reason)}`);
    }
  }
  return result;
}

export async function saveOutcome(ctx: ActionContext, action: StoredAction, outcome: ActionOutcome) {
  if (!(await responses(ctx).createIfAbsent(action.id, outcome))) {
    throw new Error("This action is already resolved or cancelled. Reload the ticket.");
  }
}
