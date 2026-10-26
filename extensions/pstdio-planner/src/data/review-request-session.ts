// Start a request conversation only after the person opens it.
import type { CommandContext, ResourceAnchor } from "@pstdio/sdk/extensions";
import { plannerTicketsChanged } from "../events";
import { readAttempt } from "./attempt-storage";
import type { AttemptRecord } from "./attempt-types";
import { findTicket } from "./resolve";
import { reviewRequestsCollection } from "./review-request-storage";
import type { ReviewRequest } from "./review-request-types";
import { parseStoredRequest } from "./review-request-validation";
import { withQueuedWriteGuard } from "./write-guard";

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

const sessionPrompt = (shorthand: string, input: Pick<ReviewRequest, "title" | "instructions">, requestId: string) =>
  [
    `Human input needed for ${shorthand}: ${input.title}`,
    input.instructions,
    `Request: ${requestId}`,
    `Help the person complete this request. Read it, including question and choice IDs, with: pst pstdio-planner review-requests read --request-id ${requestId}`,
    "Ask the person for any decision or confirmation it needs. Do not ask for secret values in chat.",
    `Save their response only after they give it: pst pstdio-planner review --request-id ${requestId} --response '<JSON>'. Tasks use {"confirmed":true}; decisions use {"answers":{"<question-id>":"<answer>"}}.`,
    "Saving a response does not perform the requested action. Use the matching Planner command for that.",
  ].join("\n\n");

const startReviewRequestSession = async (ctx: CommandContext, requestId: string) => {
  const stored = await reviewRequestsCollection(ctx.storage).get(requestId);
  if (!stored) throw new Error(`Unknown review request "${requestId}".`);
  const request = parseStoredRequest(stored);
  if (request.context.sessionId) {
    const session = await ctx.sessions.get(request.context.sessionId);
    if (!session) throw new Error("The linked chat session was removed.");
    return session;
  }
  const ticket = await findTicket(ctx, request.ticketId);
  if (!ticket) throw new Error("The ticket was removed.");
  const attempt = request.context.workspaceId ? await readAttempt(ctx.storage, request.context.workspaceId) : null;
  const requestAnchor: ResourceAnchor = {
    type: "planner-human-request",
    id: request.id,
    // The host only infers owners for older anchor kinds, so new kinds must name Planner.
    extensionId: ctx.extensionId,
    projectId: ctx.projectId,
    label: request.title,
    metadata: { ticketId: request.ticketId, requestId: request.id, phase: "other" },
  };
  const prompt = sessionPrompt(ticket.shorthand, request, request.id);
  const relatedSession = request.context.relatedSessionId
    ? await ctx.sessions.get(request.context.relatedSessionId)
    : null;
  const reusable =
    relatedSession && canReuseSession(relatedSession, ticket.id, attempt, request.context.attemptRevision ?? undefined)
      ? relatedSession
      : null;
  const session =
    reusable ??
    (await ctx.sessions.create({
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
    }));
  if (reusable) {
    await ctx.sessions.addAnchors(session.id, [requestAnchor]);
    await ctx.sessions.followup({ sessionId: session.id, prompt });
  }

  await reviewRequestsCollection(ctx.storage).update(request.id, {
    ...request,
    context: { ...request.context, sessionId: session.id },
  });
  await ctx.events.emit(plannerTicketsChanged, { ticketId: request.ticketId });
  return session;
};

// Opening and cancellation share ownership of the saved conversation link, including after handler reloads.
export const withReviewRequestSession = <T>(ctx: CommandContext, requestId: string, run: () => Promise<T>) =>
  withQueuedWriteGuard(ctx, `review-request-session:${requestId}`, run);

export const getReviewRequestSession = (ctx: CommandContext, requestId: string) =>
  withReviewRequestSession(ctx, requestId, () => startReviewRequestSession(ctx, requestId));
