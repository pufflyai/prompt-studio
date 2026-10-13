import type { CommandContext } from "@pstdio/sdk/extensions";
import { actorFromSource } from "../data/attempt-actors";
import { appendAttemptEvent, putAttempt } from "../data/attempt-storage";
import type { AttemptBlocker, AttemptRecord } from "../data/attempt-types";
import { ticketsCollection } from "../data/collections";
import { createReviewRequest, handoffRequest } from "../data/review-request-create";

export const blockAttempt = async (
  ctx: CommandContext,
  attempt: AttemptRecord,
  input: { phase: "implementation" | "review"; sessionId: string; reason: string; retryCount: number },
) => {
  const session = await ctx.sessions.get(input.sessionId);
  const blocker: AttemptBlocker = {
    phase: input.phase,
    reason: input.reason,
    sessionId: input.sessionId,
    retryCount: input.retryCount,
    lastActivityAt: session?.updated_at ?? null,
    createdAt: new Date().toISOString(),
  };
  const next = await putAttempt(ctx.storage, {
    ...attempt,
    blocker,
    updatedAt: blocker.createdAt,
  });
  await appendAttemptEvent(ctx.storage, {
    workspaceId: attempt.workspaceId,
    revision: attempt.revisions.at(-1)?.revision ?? null,
    type: "attempt_blocked",
    actor: actorFromSource(ctx.source, ctx.invocationId),
    sessionId: input.sessionId,
    reportId: null,
    reviewId: null,
    threadId: null,
    commitSha: attempt.revisions.at(-1)?.headSha ?? null,
    metadata: { phase: input.phase, reason: input.reason, retryCount: input.retryCount },
  });
  const ticket = await ticketsCollection(ctx.storage).get(attempt.ticketId);
  if (!ticket) throw new Error(`Unknown ticket "${attempt.ticketId}"`);
  await createReviewRequest(ctx, {
    ticket: attempt.ticketId,
    workspaceId: attempt.workspaceId,
    revision: attempt.revisions.at(-1)?.revision,
    sessionId: input.sessionId,
    reason: input.phase === "review" ? "review-disconnected" : "implementation-disconnected",
    title: `${input.phase} session ${input.sessionId} disconnected again for ${attempt.workspaceShorthand}.`,
    request: handoffRequest,
    instructions: `Inspect the blocker and decide how to recover workspace ${attempt.workspaceShorthand}.`,
    expectedTicketStatusId: ticket.statusId ?? "",
    expectedAttemptState: "blocked",
  });
  return next;
};
