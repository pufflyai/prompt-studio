// Create a review request with its linked chat session, reusing the attempt's session when it owns the work.
import type { CommandContext, ResourceAnchor } from "@pstdio/sdk/extensions";
import { isCompletedTicket } from "../timeline/model/workflow";
import { actorFromSource } from "./attempt-actors";
import { readAttempt } from "./attempt-storage";
import type { AttemptRecord, AttemptState } from "./attempt-types";
import { findTicket } from "./resolve";
import { keepOwnedRequest, publishRequestChange } from "./review-request-service";
import { listTicketReviewRequests, readReviewRequest, reviewRequestsCollection } from "./review-request-storage";
import type { HumanRequestReason, ReviewRequest } from "./review-request-types";
import { parseRequestBody } from "./review-request-validation";
import { readTicketStatuses } from "./status-operations";

export interface CreateReviewRequestInput {
  ticket: string;
  title: string;
  instructions: string;
  request: unknown;
  reason?: HumanRequestReason;
  workspaceId?: string;
  revision?: number;
  sessionId?: string;
  expectedTicketStatusId?: string;
  expectedAttemptState?: AttemptState;
}

// Attempt handoffs ask for one text answer that describes the decision and the completed action.
export const handoffRequest = {
  kind: "decision",
  questions: [{ id: "result", label: "Decision and completed action", required: true, input: { kind: "text" } }],
} as const;

const readExpectedAttempt = async (ctx: CommandContext, input: CreateReviewRequestInput, ticketId: string) => {
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

type SessionRecord = { id: string; anchors_json?: ResourceAnchor[] };

const sessionOwnsReview = (attempt: AttemptRecord, session: SessionRecord, revision: number | undefined) =>
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
  session: SessionRecord,
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

const sessionPrompt = (shorthand: string, input: CreateReviewRequestInput, requestId: string) =>
  [
    `Human input needed for ${shorthand}: ${input.title}`,
    input.instructions,
    `Request: ${requestId}`,
    `Help the person complete this request. Read it, including question and choice IDs, with: pst pstdio-planner review-requests read --request-id ${requestId}`,
    "Ask the person for any decision or confirmation it needs. Do not ask for secret values in chat.",
    `Save their response only after they give it: pst pstdio-planner review --request-id ${requestId} --response '<JSON>'. Tasks use {"confirmed":true}; decisions use {"answers":{"<question-id>":"<answer>"}}.`,
    "Saving a response does not perform the requested action. Use the matching Planner command for that.",
  ].join("\n\n");

const sameHandoff = (request: ReviewRequest, input: CreateReviewRequestInput) =>
  request.context.reason === input.reason &&
  request.context.workspaceId === (input.workspaceId ?? null) &&
  request.context.attemptRevision === (input.revision ?? null) &&
  request.context.relatedSessionId === (input.sessionId ?? null);

export const createReviewRequest = async (ctx: CommandContext, input: CreateReviewRequestInput) => {
  const ticket = await findTicket(ctx.storage, input.ticket);
  if (!ticket) throw new Error(`Unknown ticket "${input.ticket}"`);
  if (isCompletedTicket(ticket, (await readTicketStatuses(ctx.storage)).statuses)) {
    throw new Error("The ticket is complete.");
  }
  if (input.expectedTicketStatusId !== undefined && ticket.statusId !== input.expectedTicketStatusId) {
    throw new Error("Ticket status changed before the handoff.");
  }
  const attempt = await readExpectedAttempt(ctx, input, ticket.id);
  const body = parseRequestBody(input.request);
  if (!input.title.trim() || !input.instructions.trim()) throw new Error("A title and instructions are required.");

  // Workflow producers retry; an open request with the same handoff key is the same request.
  if (input.reason) {
    const existing = (await listTicketReviewRequests(ctx.storage, ticket.id)).requests.find(
      (request) => request.state === "open" && sameHandoff(request, input),
    );
    if (existing) return existing;
  }

  const requestId = crypto.randomUUID();
  const requestAnchor: ResourceAnchor = {
    type: "planner-human-request",
    id: requestId,
    // The host only infers owners for older anchor kinds, so new kinds must name Planner.
    extensionId: ctx.extensionId,
    projectId: ctx.projectId,
    label: input.title,
    metadata: { ticketId: ticket.id, requestId, phase: "other" },
  };
  const prompt = sessionPrompt(ticket.shorthand, input, requestId);
  const relatedSession = input.sessionId ? await ctx.sessions.get(input.sessionId) : null;
  const reusable =
    relatedSession && canReuseSession(relatedSession, ticket.id, attempt, input.revision) ? relatedSession : null;
  const sessionId = reusable
    ? reusable.id
    : (
        await ctx.sessions.create({
          title: `Human input needed: ${ticket.shorthand}`,
          prompt,
          anchors: [
            {
              type: "ticket",
              id: ticket.id,
              projectId: ctx.projectId,
              extensionId: ctx.extensionId,
              label: ticket.shorthand,
              role: "primary",
              shorthand: ticket.shorthand,
            },
            requestAnchor,
          ],
        })
      ).id;
  if (reusable) await ctx.sessions.addAnchors(sessionId, [requestAnchor]);

  const request: ReviewRequest = {
    id: requestId,
    ticketId: ticket.id,
    title: input.title.trim(),
    instructions: input.instructions.trim(),
    request: body,
    requestedAt: new Date().toISOString(),
    requestedBy: actorFromSource(ctx.source, ctx.invocationId),
    context: {
      reason: input.reason ?? null,
      workspaceId: input.workspaceId ?? null,
      attemptRevision: input.revision ?? null,
      sessionId,
      relatedSessionId: input.sessionId ?? null,
    },
  };
  await reviewRequestsCollection(ctx.storage).createIfAbsent(request.id, request);
  await keepOwnedRequest(ctx, request);
  await publishRequestChange(ctx, ticket.id);
  if (reusable) await ctx.sessions.followup({ sessionId, prompt });
  return (await readReviewRequest(ctx.storage, request.id))!;
};
