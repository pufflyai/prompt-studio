import { defineHook, sessionEvents } from "@pstdio/sdk/extensions";
import { ticketRefFromAnchors } from "../data/workspace-ticket-link";
import { blockedKey } from "../notifications/dedupe-keys";

export const sessionAwaitingInputHook = defineHook({
  event: sessionEvents.awaitingInput,
  async handler(ctx, payload) {
    const ticketId = ticketRefFromAnchors(payload.workspace?.anchors_json ?? payload.anchors);
    if (!ticketId) return;
    await ctx.notify.action({
      kind: "blocked",
      priority: "high",
      title: `Ticket ${ticketId} is blocked`,
      body: "The agent paused waiting for your input. Open the session to reply.",
      target: { type: "ticket", id: ticketId, label: ticketId },
      related: [{ type: "session", id: payload.sessionId }],
      actions: [
        {
          id: "reply",
          label: "Reply to agent",
          kind: "open-resource",
          resource: { type: "session", id: payload.sessionId },
          primary: true,
        },
      ],
      dedupeKey: blockedKey(ticketId),
    });
  },
});

export const sessionResumedHook = defineHook({
  event: sessionEvents.resumed,
  async handler(ctx, payload) {
    const ticketId = ticketRefFromAnchors(payload.workspace?.anchors_json ?? payload.anchors);
    if (!ticketId) return;
    await ctx.notify.resolve({ dedupeKey: blockedKey(ticketId) });
  },
});
