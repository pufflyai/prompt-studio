import {
  defineCommand,
  type ExtensionDefinition,
  eventRef,
  type ResourceAnchor,
  sessionEvents,
} from "@pstdio/sdk/extensions";
import {
  implementationTickRun,
  type LoopCtx,
  onTicketEnteredRefine,
  refinementSweepRun,
  reviewTickRun,
  stuckWorkSweepRun,
} from "./loops";
import { readAutomationStatusIds } from "./settings";

export const refinementSweepCommand = defineCommand({
  title: "Refinement sweep",
  description: "Pick the oldest Refine-status ticket without human_requested and run refinement.",
  async run(ctx) {
    return refinementSweepRun(ctx as unknown as LoopCtx);
  },
});

export const implementationTickCommand = defineCommand({
  title: "Implementation tick",
  description: "Dispatch Ready-status tickets to the implement-ticket command, respecting the maxInProgress cap.",
  async run(ctx) {
    return implementationTickRun(ctx as unknown as LoopCtx);
  },
});

export const stuckWorkSweepCommand = defineCommand({
  title: "Stuck-work sweep",
  description: "Move long-running In Progress tickets to Blocked or In Review when no workspace is active.",
  async run(ctx) {
    return stuckWorkSweepRun(ctx as unknown as LoopCtx);
  },
});

export const reviewTickCommand = defineCommand({
  title: "Review tick",
  description: "Run review on In Review tickets when every workspace is inactive.",
  async run(ctx) {
    return reviewTickRun(ctx as unknown as LoopCtx);
  },
});

// Planner emits this event from `set-ticket-attribute` whenever a ticket's
// statusId changes. We listen so refinement can fire the instant a human drags
// a ticket into the Refine column instead of waiting for the hourly cron.
export const ticketStatusChangedEvent = eventRef<{
  ticketId: string;
  shorthand: string;
  previousStatusId: string | null;
  statusId: string | null;
  changedAt: string;
}>("pstdio-planner.ticket-status-changed");

export const onTicketStatusChangedHook: NonNullable<ExtensionDefinition["hooks"]>[string] = {
  event: ticketStatusChangedEvent,
  async handler(ctx, payload) {
    const statusIds = await readAutomationStatusIds(ctx.settings);
    if (payload.statusId !== statusIds.refine) return;
    await onTicketEnteredRefine(ctx as unknown as LoopCtx, payload.shorthand);
  },
};

export const onSessionStartedHook: NonNullable<ExtensionDefinition["hooks"]>[string] = {
  event: sessionEvents.started,
  async handler(ctx, payload) {
    const anchors: ResourceAnchor[] = payload.workspace?.anchors_json ?? payload.anchors ?? [];
    const ticketAnchor = anchors.find((anchor) => anchor.type === "ticket");
    if (!ticketAnchor) return;
    const shorthandMeta = ticketAnchor.metadata?.shorthand;
    const ticketRef = (typeof shorthandMeta === "string" && shorthandMeta) || ticketAnchor.id;
    const statusIds = await readAutomationStatusIds(ctx.settings);
    await ctx.commands.execute("pstdio-planner.set-ticket-attribute", {
      params: { rowId: ticketRef, attributeId: "status", value: statusIds.inProgress },
    });
  },
};
