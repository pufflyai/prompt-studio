import { type CommandContext, defineCommand, params, type ResourceAnchor } from "@pstdio/sdk/extensions";
import { actorFromSource } from "../data/attempt-actors";
import { humanRequestsCollection, readAttempt } from "../data/attempt-storage";
import type { AttemptRecord, AttemptState, HumanRequestReason, HumanRequestRecord } from "../data/attempt-types";
import { ticketsCollection } from "../data/collections";
import { findTicket } from "../data/resolve";
import { seedDefaultTags } from "../data/seed";

const HUMAN_REQUESTED_OPTION_ID = "default-human-requested-true";

interface RequestHumanInput {
  ticket: string;
  workspaceId?: string;
  revision?: number;
  sessionId?: string;
  reason: HumanRequestReason;
  question: string;
  expectedAction: string;
  expectedTicketStatusId: string;
  expectedAttemptState?: AttemptState;
}

const addHumanRequestedFlag = async (ctx: Pick<CommandContext, "storage">, ticketId: string) => {
  const tags = await seedDefaultTags(ctx.storage);
  const flag = tags
    .find((tag) => tag.id === "default-human-requested")
    ?.options.find((option) => option.id === HUMAN_REQUESTED_OPTION_ID);
  if (!flag) throw new Error("The required Human Requested workflow flag is unavailable.");
  const ticket = await ticketsCollection(ctx.storage).get(ticketId);
  if (!ticket) throw new Error(`Unknown ticket "${ticketId}"`);
  if ((ticket.tagIds ?? []).includes(flag.id)) return ticket;
  const next = { ...ticket, tagIds: [...(ticket.tagIds ?? []), flag.id], updatedAt: new Date().toISOString() };
  await ticketsCollection(ctx.storage).put(ticket.id, next);
  return next;
};

const requestKeyMatches = (request: HumanRequestRecord, input: RequestHumanInput, ticketId: string) =>
  request.state === "open" &&
  request.ticketId === ticketId &&
  request.reason === input.reason &&
  request.workspaceId === (input.workspaceId ?? null) &&
  request.revision === (input.revision ?? null) &&
  request.relatedSessionId === (input.sessionId ?? null);

const ticketAnchor = (
  ctx: Pick<CommandContext, "extensionId" | "projectId">,
  ticket: { id: string; shorthand: string },
) =>
  ({
    type: "ticket",
    id: ticket.id,
    projectId: ctx.projectId,
    extensionId: ctx.extensionId,
    label: ticket.shorthand,
    role: "primary",
    metadata: { shorthand: ticket.shorthand },
  }) satisfies ResourceAnchor;

const readExpectedAttempt = async (ctx: CommandContext, input: RequestHumanInput, ticketId: string) => {
  if (!input.workspaceId || !input.expectedAttemptState) return null;
  const attempt = await readAttempt(ctx.storage, input.workspaceId);
  if (!attempt || attempt.ticketId !== ticketId || attempt.state !== input.expectedAttemptState) {
    throw new Error("Attempt state changed before the handoff.");
  }
  if (input.revision !== undefined && attempt.revisions.at(-1)?.revision !== input.revision) {
    throw new Error("Attempt revision changed before the handoff.");
  }
  return attempt;
};

const sessionOwnsReview = (
  attempt: AttemptRecord,
  session: { id: string; anchors_json?: ResourceAnchor[] },
  revision: number | undefined,
) =>
  attempt.revisions
    .flatMap((candidate) => candidate.reviews)
    .some(
      (review) =>
        review.sessionId === session.id &&
        (session.anchors_json ?? []).some(
          (anchor) =>
            anchor.type === "planner-review" &&
            anchor.metadata?.workspaceId === attempt.workspaceId &&
            (revision === undefined || anchor.metadata.revision === revision),
        ),
    );

const canReuseSession = (
  session: { id: string; anchors_json?: ResourceAnchor[] },
  ticketId: string,
  attempt: AttemptRecord | null,
  revision: number | undefined,
) => {
  const anchors = session.anchors_json ?? [];
  if (!attempt) return anchors.some((anchor) => anchor.type === "ticket" && anchor.id === ticketId);
  const ownsImplementation =
    attempt.implementationSessionId === session.id &&
    anchors.some((anchor) => anchor.type === "planner-attempt" && anchor.id === attempt.workspaceId);
  return ownsImplementation || sessionOwnsReview(attempt, session, revision);
};

export const requestHuman = async (ctx: CommandContext, input: RequestHumanInput) => {
  const ticket = await findTicket(ctx.storage, input.ticket);
  if (!ticket) throw new Error(`Unknown ticket "${input.ticket}"`);
  if (ticket.statusId !== input.expectedTicketStatusId) throw new Error("Ticket status changed before the handoff.");
  const attempt = await readExpectedAttempt(ctx, input, ticket.id);

  const requests = humanRequestsCollection(ctx.storage);
  const existing = (await requests.list()).find((request) => requestKeyMatches(request, input, ticket.id));
  if (existing) return existing;

  const requestId = crypto.randomUUID();
  const requestAnchor: ResourceAnchor = {
    type: "planner-human-request",
    id: requestId,
    label: input.reason,
    metadata: { ticketId: ticket.id, requestId, phase: "other" },
  };
  const relatedSession = input.sessionId ? await ctx.sessions.get(input.sessionId) : null;
  const reusableSession =
    relatedSession && canReuseSession(relatedSession, ticket.id, attempt, input.revision) ? relatedSession : null;
  let sessionId = reusableSession?.id ?? null;
  if (sessionId) {
    await ctx.sessions.addAnchors(sessionId, [requestAnchor]);
  } else {
    const session = await ctx.sessions.create({
      title: `Human input needed: ${ticket.shorthand}`,
      prompt: input.question,
      anchors: [ticketAnchor(ctx, ticket), requestAnchor],
    });
    sessionId = session.id;
  }

  const record: HumanRequestRecord = {
    id: requestId,
    ticketId: ticket.id,
    workspaceId: input.workspaceId ?? null,
    revision: input.revision ?? null,
    sessionId,
    relatedSessionId: input.sessionId ?? null,
    reason: input.reason,
    question: input.question,
    expectedAction: input.expectedAction,
    state: "open",
    requestedAt: new Date().toISOString(),
    resolvedAt: null,
    resolvedBy: null,
    resolution: null,
  };
  await requests.put(record.id, record);
  await addHumanRequestedFlag(ctx, ticket.id);
  if (reusableSession) {
    await ctx.sessions.followup({
      sessionId,
      prompt: `${input.question}\n\nExpected action: ${input.expectedAction}\nRequest: ${record.id}`,
    });
  }
  return record;
};

const humanRequestReasons: HumanRequestReason[] = [
  "approved-revision",
  "ambiguous-dependency-attempt",
  "divergent-dependency-attempts",
  "dependency-cycle",
  "dependency-missing",
  "implementation-disconnected",
  "review-disconnected",
  "workspace-adoption-required",
];

const attemptStates: AttemptState[] = [
  "implementing",
  "review_ready",
  "reviewing",
  "approved",
  "changes_requested",
  "blocked",
  "abandoned",
];

export const requestHumanCommand = defineCommand({
  title: "Request human input",
  cli: true,
  params: {
    ticket: params.text({ required: true }),
    workspaceId: params.text(),
    revision: params.number(),
    sessionId: params.text(),
    reason: params.select({
      required: true,
      options: humanRequestReasons.map((reason) => ({ label: reason, value: reason })),
    }),
    question: params.longText({ required: true }),
    expectedAction: params.longText({ required: true }),
    expectedTicketStatusId: params.text({ required: true }),
    expectedAttemptState: params.select({
      options: attemptStates.map((state) => ({ label: state, value: state })),
    }),
  },
  async run(ctx) {
    return requestHuman(ctx, ctx.params as RequestHumanInput);
  },
});

export const resolveHumanRequestCommand = defineCommand({
  title: "Resolve human request",
  cli: true,
  params: {
    requestId: params.text({ required: true }),
    resolution: params.longText({ required: true }),
    completedAction: params.longText({ required: true }),
  },
  async run(ctx) {
    if (ctx.source === "schedule" || ctx.source === "automation" || ctx.source === "event") {
      throw new Error("Automation cannot resolve a human request.");
    }
    const requests = humanRequestsCollection(ctx.storage);
    const request = await requests.get(ctx.params.requestId);
    if (!request || request.state !== "open") throw new Error(`Unknown open human request "${ctx.params.requestId}"`);
    const resolved: HumanRequestRecord = {
      ...request,
      state: "resolved",
      resolvedAt: new Date().toISOString(),
      resolvedBy: actorFromSource(ctx.source, ctx.invocationId),
      resolution: `${ctx.params.resolution}\n\nCompleted action: ${ctx.params.completedAction}`,
    };
    await requests.put(resolved.id, resolved);

    const remaining = (await requests.list()).some(
      (candidate) => candidate.ticketId === request.ticketId && candidate.state === "open",
    );
    if (!remaining) {
      const ticket = await ticketsCollection(ctx.storage).get(request.ticketId);
      if (ticket) {
        await ticketsCollection(ctx.storage).put(ticket.id, {
          ...ticket,
          tagIds: (ticket.tagIds ?? []).filter((id) => id !== HUMAN_REQUESTED_OPTION_ID),
          updatedAt: new Date().toISOString(),
        });
      }
    }
    return resolved;
  },
});
