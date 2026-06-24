import { defineHook, gitEvents } from "@pstdio/sdk/extensions";
import { ticketRefFromAnchors } from "../data/workspace-ticket-link";
import { readyToMergeKey } from "../notifications/dedupe-keys";

export const gitMergedHook = defineHook({
  event: gitEvents.merged,
  async handler(ctx, payload) {
    const ticketId = ticketRefFromAnchors(payload.workspace?.anchors_json ?? payload.anchors);
    if (!ticketId) return;

    await ctx.notify.resolve({ dedupeKey: readyToMergeKey(ticketId) });
  },
});
