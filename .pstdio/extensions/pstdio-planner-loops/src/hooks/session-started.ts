import { type ResourceAnchor, sessionEvents } from "@pstdio/sdk/extensions";
import { executePlanner, type PlannerContext, planner } from "../planner-client";
import { statusIdByNames } from "../selection";

// The ticket reference carried by a session lifecycle payload: an explicit ticket
// anchor, else the `<ticket>_A<n>` workspace-shorthand convention.
const ticketRefFromAnchors = (anchors: ResourceAnchor[] | undefined) =>
  anchors?.find((anchor) => anchor.type === "ticket")?.id ?? null;

const ticketRefFromShorthand = (shorthand: string | undefined) => {
  if (!shorthand) return null;
  return /^(.*)_A\d+$/.exec(shorthand)?.[1] ?? null;
};

export const ticketRefFromLifecyclePayload = (payload: {
  anchors?: ResourceAnchor[];
  branch?: string;
  workspace?: { anchors_json?: ResourceAnchor[]; workspace_shorthand?: string } | null;
}) =>
  ticketRefFromAnchors(payload.workspace?.anchors_json) ??
  ticketRefFromAnchors(payload.anchors) ??
  ticketRefFromShorthand(payload.workspace?.workspace_shorthand) ??
  ticketRefFromShorthand(payload.branch?.replace(/^workspace\//, ""));

// Best-effort and idempotent: a missing ticket, absent in-progress column, or
// ticket already in progress is a no-op.
export const moveTicketToInProgress = async (ctx: PlannerContext, ticketRef: string) => {
  const ticket = await executePlanner(ctx, planner.getTicket, { id: ticketRef });
  if (!ticket) return false;

  const { statuses } = await executePlanner(ctx, planner.readStatuses, {});
  const inProgressId = statusIdByNames(statuses, ["In Progress", "wip"]);
  if (!inProgressId || ticket.statusId === inProgressId) return false;

  await executePlanner(ctx, planner.setTicketAttribute, {
    rowId: ticket.id,
    attributeId: "status",
    value: inProgressId,
  });
  return true;
};

// When a session starts for a ticket-linked workspace, the ticket is being worked
// on: move it into the in-progress column through the planner's public commands.
export const sessionStartedHook = {
  event: sessionEvents.started,
  async handler(ctx: PlannerContext, payload: Parameters<typeof ticketRefFromLifecyclePayload>[0]) {
    if (payload.anchors?.some((anchor) => anchor.type === "planner-review")) return;
    const ticketRef = ticketRefFromLifecyclePayload(payload);
    if (ticketRef) await moveTicketToInProgress(ctx, ticketRef);
  },
};
