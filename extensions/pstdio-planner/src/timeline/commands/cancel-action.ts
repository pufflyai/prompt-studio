// Withdraw an unanswered request without losing its instructions or accepting stale answers.
import { defineCommand, params } from "@pstdio/sdk/extensions";
import { planChanged } from "../contracts";
import { keepOwnedAction, ownedAction } from "./action-owner";
import { saveOutcome } from "./action-store";

export const cancelActionCommand = defineCommand({
  id: "timeline.action.cancel",
  title: "Cancel human request",
  cli: { description: "Withdraw an unanswered request. Correct it by creating a new request." },
  mutating: true,
  params: {
    ticket: params.text({ required: true }),
    actionId: params.text({ required: true }),
    expectedRevision: params.number({ required: true }),
    reason: params.text({ required: true }),
  },
  async run(ctx, { ticket, actionId, expectedRevision, reason }) {
    const { stored, action } = await ownedAction(ctx, ticket, actionId);
    if (action.revision !== expectedRevision) {
      throw new Error("The request changed. Reload it.");
    }
    if (action.resolution || action.cancellation) {
      throw new Error("This action is already resolved or cancelled.");
    }
    if (!reason.trim()) {
      throw new Error("A cancellation reason is required.");
    }
    const cancellation = { at: new Date().toISOString(), reason: reason.trim() };
    await saveOutcome(ctx, stored, { kind: "cancelled", cancellation });
    await keepOwnedAction(ctx, stored);
    await ctx.events.emit(planChanged, { reason: "action-cancelled" });
    return { ...action, cancellation };
  },
});
