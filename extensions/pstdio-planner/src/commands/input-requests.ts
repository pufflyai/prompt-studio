import { type CommandContext, defineCommand, params, type ResourceAnchor } from "@pstdio/sdk/extensions";
import { actorFromSource } from "../data/attempt-actors";
import { inputRequestsCollection, readAttempt } from "../data/attempt-storage";
import type { AttemptRecord, AttemptState, InputRequestReason, InputRequestRecord } from "../data/attempt-types";
import { ticketsCollection } from "../data/collections";
import { findTicket } from "../data/resolve";
import { seedDefaultTags } from "../data/seed";
import { plannerTicketsChanged } from "../events";
import { notifyInputRequested, resolveInputRequestNotification } from "../planner-notifications";

const AWAITING_INPUT_OPTION_ID = "default-awaiting-input-true";

interface RequestInput {
  ticket: string;
  workspaceId?: string;
  revision?: number;
  sessionId?: string;
  reason: InputRequestReason;
  question: string;
  expectedAction: string;
  expectedTicketStatusId: string;
  expectedAttemptState?: AttemptState;
}

const addAwaitingInputFlag = async (ctx: Pick<CommandContext, "storage">, ticketId: string) => {
  const tags = await seedDefaultTags(ctx.storage);
  const flag = tags
    .find((tag) => tag.id === "default-awaiting-input")
    ?.options.find((option) => option.id === AWAITING_INPUT_OPTION_ID);
  if (!flag) throw new Error("The required Awaiting Input workflow flag is unavailable.");
  const ticket = await ticketsCollection(ctx.storage).get(ticketId);
  if (!ticket) throw new Error(`Unknown ticket "${ticketId}"`);
  if ((ticket.tagIds ?? []).includes(flag.id)) return ticket;
  const next = { ...ticket, tagIds: [...(ticket.tagIds ?? []), flag.id], updatedAt: new Date().toISOString() };
  await ticketsCollection(ctx.storage).put(ticket.id, next);
  return next;
};

const requestKeyMatches = (request: InputRequestRecord, input: RequestInput, ticketId: string) =>
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

const readExpectedAttempt = async (ctx: CommandContext, input: RequestInput, ticketId: string) => {
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

export const requestInput = async (ctx: CommandContext, input: RequestInput) => {
  const ticket = await findTicket(ctx.storage, input.ticket);
  if (!ticket) throw new Error(`Unknown ticket "${input.ticket}"`);
  if (ticket.statusId !== input.expectedTicketStatusId) throw new Error("Ticket status changed before the handoff.");
  const attempt = await readExpectedAttempt(ctx, input, ticket.id);

  const requests = inputRequestsCollection(ctx.storage);
  const existing = (await requests.list()).find((request) => requestKeyMatches(request, input, ticket.id));
  if (existing) {
    await addAwaitingInputFlag(ctx, ticket.id);
    await notifyInputRequested(ctx, ticket, existing);
    await ctx.events.emit(plannerTicketsChanged, { ticketId: ticket.id });
    return existing;
  }

  const requestId = crypto.randomUUID();
  const requestAnchor: ResourceAnchor = {
    type: "planner-input-request",
    id: requestId,
    label: input.reason,
    metadata: { ticketId: ticket.id, requestId, phase: "other" },
  };
  const relatedSession = input.sessionId ? await ctx.sessions.get(input.sessionId) : null;
  const reusableSession =
    relatedSession && canReuseSession(relatedSession, ticket.id, attempt, input.revision) ? relatedSession : null;
  if (input.reason === "refinement-ready" && !reusableSession) {
    throw new Error("Refinement handoffs require the existing ticket refinement session.");
  }
  let sessionId = reusableSession?.id ?? null;
  if (sessionId) {
    await ctx.sessions.addAnchors(sessionId, [requestAnchor]);
  } else {
    const session = await ctx.sessions.create({
      title: `Input needed: ${ticket.shorthand}`,
      prompt: input.question,
      anchors: [ticketAnchor(ctx, ticket), requestAnchor],
    });
    sessionId = session.id;
  }

  const record: InputRequestRecord = {
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
  await addAwaitingInputFlag(ctx, ticket.id);
  if (reusableSession && input.reason !== "refinement-ready") {
    await ctx.sessions.followup({
      sessionId,
      prompt: `${input.question}\n\nExpected action: ${input.expectedAction}\nRequest: ${record.id}`,
    });
  }
  await notifyInputRequested(ctx, ticket, record);
  await ctx.events.emit(plannerTicketsChanged, { ticketId: ticket.id });
  return record;
};

const inputRequestReasons: InputRequestReason[] = [
  "approved-revision",
  "ambiguous-dependency-attempt",
  "divergent-dependency-attempts",
  "dependency-cycle",
  "dependency-missing",
  "implementation-disconnected",
  "refinement-ready",
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

export const requestInputCommand = defineCommand({
  title: "Request input",
  cli: true,
  params: {
    ticket: params.text({ required: true }),
    workspaceId: params.text(),
    revision: params.number(),
    sessionId: params.text(),
    reason: params.select({
      required: true,
      options: inputRequestReasons.map((reason) => ({ label: reason, value: reason })),
    }),
    question: params.longText({ required: true }),
    expectedAction: params.longText({ required: true }),
    expectedTicketStatusId: params.text({ required: true }),
    expectedAttemptState: params.select({
      options: attemptStates.map((state) => ({ label: state, value: state })),
    }),
  },
  async run(ctx) {
    return requestInput(ctx, ctx.params as RequestInput);
  },
});

const inputRequestStates: InputRequestRecord["state"][] = ["open", "resolved"];

export const listInputRequestsCommand = defineCommand({
  title: "List input requests",
  cli: true,
  params: {
    ticket: params.text(),
    state: params.select({
      options: inputRequestStates.map((state) => ({ label: state, value: state })),
    }),
  },
  async run(ctx) {
    const ticket = ctx.params.ticket ? await findTicket(ctx.storage, ctx.params.ticket) : null;
    if (ctx.params.ticket && !ticket) throw new Error(`Unknown ticket "${ctx.params.ticket}"`);
    return (await inputRequestsCollection(ctx.storage).list())
      .filter((request) => !ticket || request.ticketId === ticket.id)
      .filter((request) => !ctx.params.state || request.state === ctx.params.state)
      .map((request) => ({
        id: request.id,
        ticketId: request.ticketId,
        question: request.question,
        expectedAction: request.expectedAction,
        state: request.state,
        sessionId: request.sessionId,
        relatedSessionId: request.relatedSessionId,
        workspaceId: request.workspaceId,
        revision: request.revision,
      }));
  },
});

export const resolveInputRequestCommand = defineCommand({
  title: "Resolve input request",
  cli: true,
  params: {
    requestId: params.text({ required: true }),
    resolution: params.longText({ required: true }),
    completedAction: params.longText({ required: true }),
  },
  async run(ctx) {
    if (ctx.source === "schedule" || ctx.source === "automation" || ctx.source === "event") {
      throw new Error("Automation cannot resolve an input request.");
    }
    const requests = inputRequestsCollection(ctx.storage);
    const request = await requests.get(ctx.params.requestId);
    if (!request || request.state !== "open") throw new Error(`Unknown open input request "${ctx.params.requestId}"`);
    const resolved: InputRequestRecord = {
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
          tagIds: (ticket.tagIds ?? []).filter((id) => id !== AWAITING_INPUT_OPTION_ID),
          updatedAt: new Date().toISOString(),
        });
      }
    }
    await resolveInputRequestNotification(ctx, resolved.id);
    await ctx.events.emit(plannerTicketsChanged, { ticketId: request.ticketId });
    return resolved;
  },
});
