import type { CreateNotificationInput, ResourceAnchor } from "@pstdio/sdk/extensions";
import type { InputRequestRecord } from "./data/attempt-types";
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

export const inputRequestNotificationDedupeKey = (requestId: string) => `pstdio-planner:input-request:${requestId}`;

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

export const notifyInputRequested = (ctx: NotifyActionContext, ticket: StoredTicket, request: InputRequestRecord) => {
  const ticketTarget = ticketAnchor(ctx, ticket);
  const sessionTarget: ResourceAnchor = {
    type: "session",
    id: request.sessionId,
    projectId: ctx.projectId,
    extensionId: ctx.extensionId,
  };
  return notifyAction(ctx, {
    title: `Awaiting input: ${ticket.shorthand}`,
    body: request.question,
    kind: "blocked",
    priority: "high",
    target: ticketTarget,
    related: [sessionTarget],
    dedupeKey: inputRequestNotificationDedupeKey(request.id),
    actions: [
      {
        id: "open-session",
        label: "Open session",
        kind: "open-resource",
        resource: sessionTarget,
        primary: true,
      },
      { id: "open-ticket", label: "Open ticket", kind: "open-resource", resource: ticketTarget },
    ],
    metadata: {
      ticketId: ticket.id,
      ticketShorthand: ticket.shorthand,
      inputRequestId: request.id,
      sessionId: request.sessionId,
    },
  });
};

export const resolveProposalRefinedNotification = (ctx: NotifyResolveContext, ticket: StoredTicket) =>
  notifyResolve(ctx, { dedupeKey: ticketNotificationDedupeKey(ticket, "proposal-refined"), status: "done" });

export const resolveBlockedNotification = (ctx: NotifyResolveContext, ticket: StoredTicket) =>
  notifyResolve(ctx, { dedupeKey: ticketNotificationDedupeKey(ticket, "blocked"), status: "done" });

export const resolveInputRequestNotification = (ctx: NotifyResolveContext, requestId: string) =>
  notifyResolve(ctx, { dedupeKey: inputRequestNotificationDedupeKey(requestId), status: "done" });
