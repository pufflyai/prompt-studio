import { defineHook, sessionEvents } from "@pstdio/sdk/extensions";
import { ticketRefFromAnchors } from "../data/workspace-ticket-link";
import { proposalRefinedKey, readyToMergeKey } from "../notifications/dedupe-keys";

const RELEASE_SESSION_TITLE_PATTERNS = [/^Refine ticket:/i, /^Refine\b/i];
const READY_TO_MERGE_TITLE_PATTERNS = [/^Implement ticket:/i, /^Implementation\b/i, /^Run attempt/i];

const sessionTitleMatches = (title: string | undefined, patterns: RegExp[]) =>
  typeof title === "string" && patterns.some((re) => re.test(title));

export const sessionSucceededHook = defineHook({
  event: sessionEvents.succeeded,
  async handler(ctx, payload) {
    const ticketId = ticketRefFromAnchors(payload.workspace?.anchors_json ?? payload.anchors);
    if (!ticketId) return;

    if (sessionTitleMatches(payload.sessionTitle, RELEASE_SESSION_TITLE_PATTERNS)) {
      await ctx.notify.action({
        kind: "needs_review",
        priority: "normal",
        title: `Ticket ${ticketId} proposal refined`,
        body: "Review the refined proposal before implementation starts.",
        target: { type: "ticket", id: ticketId, label: ticketId },
        actions: [
          {
            id: "review",
            label: "Review proposal",
            kind: "open-resource",
            resource: { type: "ticket", id: ticketId },
            primary: true,
          },
          {
            id: "approve",
            label: "Approve",
            kind: "command",
            command: "pstdio-planner.approve-proposal",
            params: { ticketId },
          },
        ],
        dedupeKey: proposalRefinedKey(ticketId),
      });
      return;
    }

    if (sessionTitleMatches(payload.sessionTitle, READY_TO_MERGE_TITLE_PATTERNS) && payload.workspaceId) {
      await ctx.notify.action({
        kind: "ready_to_merge",
        priority: "normal",
        title: `Ticket ${ticketId} ready for merge`,
        target: { type: "ticket", id: ticketId, label: ticketId },
        related: [{ type: "workspace", id: payload.workspaceId }],
        actions: [
          {
            id: "open-workspace",
            label: "Open workspace",
            kind: "open-resource",
            resource: { type: "workspace", id: payload.workspaceId },
            primary: true,
          },
        ],
        dedupeKey: readyToMergeKey(ticketId),
      });
    }
  },
});
