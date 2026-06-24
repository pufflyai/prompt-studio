import type { CreateNotificationInput, ExtensionWorkspace, ResourceAnchor } from "@pstdio/sdk/extensions";
import type { StoredTicket } from "./data/types";

type PlannerNotificationInput = Omit<CreateNotificationInput, "projectId">;

interface PlannerContext {
  extensionId: string;
  projectId: string;
}

interface NotifyActionContext extends PlannerContext {
  notify: { action?: (input: PlannerNotificationInput) => Promise<unknown> };
}

interface NotifyResolveContext {
  notify: { resolve?: (input: { dedupeKey: string; status: "done" }) => Promise<unknown> };
}

const notifyAction = (ctx: NotifyActionContext, input: PlannerNotificationInput) => {
  if (typeof ctx.notify.action !== "function") return undefined;
  return ctx.notify.action(input);
};
const notifyResolve = (ctx: NotifyResolveContext, input: { dedupeKey: string; status: "done" }) =>
  typeof ctx.notify.resolve === "function" ? ctx.notify.resolve(input) : undefined;

export const ticketNotificationDedupeKey = (ticket: StoredTicket | string, reason: string) => {
  const shorthand = typeof ticket === "string" ? ticket : ticket.shorthand;
  return `pstdio-planner:ticket:${shorthand}:${reason}`;
};

export const reviewReadyDedupeKey = (workspaceId: string) => `pstdio-planner:workspace:${workspaceId}:review-ready`;

export const ticketAnchor = (ctx: PlannerContext, ticket: StoredTicket) =>
  ({
    type: "ticket",
    id: ticket.id,
    projectId: ctx.projectId,
    extensionId: ctx.extensionId,
    label: ticket.shorthand,
    role: "primary",
    metadata: { shorthand: ticket.shorthand },
  }) satisfies ResourceAnchor;

export const workspaceResource = (ctx: PlannerContext, workspace: ExtensionWorkspace, ticket: StoredTicket) => ({
  type: "workspace",
  id: workspace.id,
  projectId: ctx.projectId,
  extensionId: ctx.extensionId,
  label: workspace.workspace_shorthand ?? workspace.name ?? workspace.id,
  metadata: {
    ticket: ticket.shorthand,
    ticketId: ticket.id,
    workspaceId: workspace.id,
    ...(workspace.workspace_shorthand ? { workspaceShorthand: workspace.workspace_shorthand } : {}),
  },
});

export const notifyProposalRefined = (ctx: NotifyActionContext, ticket: StoredTicket) => {
  const target = ticketAnchor(ctx, ticket);
  return notifyAction(ctx, {
    title: `Review proposal: ${ticket.shorthand}`,
    body: `${ticket.title} is ready for approval.`,
    kind: "needs_review",
    priority: "high",
    target,
    dedupeKey: ticketNotificationDedupeKey(ticket, "proposal-refined"),
    actions: [
      { id: "review-proposal", label: "Review proposal", kind: "open-resource", resource: target, primary: true },
      {
        id: "approve-proposal",
        label: "Approve",
        kind: "command",
        command: "pstdio-planner.approve-proposal",
        params: { ticket: ticket.shorthand },
      },
    ],
    metadata: { ticketId: ticket.id, ticketShorthand: ticket.shorthand },
  });
};

export const notifyReviewReady = async (
  ctx: NotifyActionContext,
  workspace: ExtensionWorkspace,
  ticket: StoredTicket,
  reviewSessionId: string,
) => {
  const target = workspaceResource(ctx, workspace, ticket);
  await notifyAction(ctx, {
    title: `Review ready: ${ticket.shorthand}`,
    body: `${target.label} is ready for review.`,
    kind: "needs_review",
    priority: "high",
    target,
    related: [ticketAnchor(ctx, ticket)],
    dedupeKey: reviewReadyDedupeKey(workspace.id),
    actions: [
      { id: "open-workspace", label: "Open workspace", kind: "open-resource", resource: target, primary: true },
      { id: "open-ticket", label: "Open ticket", kind: "open-resource", resource: ticketAnchor(ctx, ticket) },
    ],
    metadata: {
      ticketId: ticket.id,
      ticketShorthand: ticket.shorthand,
      workspaceId: workspace.id,
      reviewSessionId,
    },
  });
};

export const notifyReadyToMerge = (ctx: NotifyActionContext, ticket: StoredTicket) => {
  const target = ticketAnchor(ctx, ticket);
  return notifyAction(ctx, {
    title: `Ready to merge: ${ticket.shorthand}`,
    body: `${ticket.title} has been reviewed and is ready to merge.`,
    kind: "ready_to_merge",
    priority: "high",
    target,
    dedupeKey: ticketNotificationDedupeKey(ticket, "ready-to-merge"),
    actions: [{ id: "open-ticket", label: "Open ticket", kind: "open-resource", resource: target, primary: true }],
    metadata: { ticketId: ticket.id, ticketShorthand: ticket.shorthand },
  });
};

export const notifyBlocked = (ctx: NotifyActionContext, ticket: StoredTicket, sessionId?: string) => {
  const target = ticketAnchor(ctx, ticket);
  const related = sessionId
    ? [{ type: "session", id: sessionId, projectId: ctx.projectId, extensionId: ctx.extensionId }]
    : [];
  return notifyAction(ctx, {
    title: `Needs input: ${ticket.shorthand}`,
    body: ticket.blockedReason ?? `${ticket.title} is blocked and needs input.`,
    kind: "blocked",
    priority: "high",
    target,
    related,
    dedupeKey: ticketNotificationDedupeKey(ticket, "blocked"),
    actions: sessionId
      ? [{ id: "reply-to-agent", label: "Reply to agent", kind: "open-resource", resource: related[0], primary: true }]
      : [{ id: "open-ticket", label: "Open ticket", kind: "open-resource", resource: target, primary: true }],
    metadata: { ticketId: ticket.id, ticketShorthand: ticket.shorthand, ...(sessionId ? { sessionId } : {}) },
  });
};

export const resolveReviewReadyNotification = (ctx: NotifyResolveContext, workspaceId: string) =>
  notifyResolve(ctx, { dedupeKey: reviewReadyDedupeKey(workspaceId), status: "done" });

export const resolveProposalRefinedNotification = (ctx: NotifyResolveContext, ticket: StoredTicket) =>
  notifyResolve(ctx, { dedupeKey: ticketNotificationDedupeKey(ticket, "proposal-refined"), status: "done" });

export const resolveReadyToMergeNotification = (ctx: NotifyResolveContext, ticket: StoredTicket) =>
  notifyResolve(ctx, { dedupeKey: ticketNotificationDedupeKey(ticket, "ready-to-merge"), status: "done" });

export const resolveBlockedNotification = (ctx: NotifyResolveContext, ticket: StoredTicket) =>
  notifyResolve(ctx, { dedupeKey: ticketNotificationDedupeKey(ticket, "blocked"), status: "done" });
