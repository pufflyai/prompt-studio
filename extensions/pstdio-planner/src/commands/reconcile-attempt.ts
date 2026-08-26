import { type CommandContext, defineCommand, params, type ResourceAnchor } from "@pstdio/sdk/extensions";
import { actorFromSource } from "../data/attempt-actors";
import { rollUpAttemptTicket } from "../data/attempt-rollup";
import {
  appendAttemptEvent,
  listAttempts,
  putAttempt,
  readAttempt,
  reviewLaunchClaimsCollection,
} from "../data/attempt-storage";
import type { AttemptBlocker, AttemptRecord, AttemptReview } from "../data/attempt-types";
import { ticketsCollection } from "../data/collections";
import { requestHuman } from "./human-requests";

const liveStatuses = new Set(["queued", "in_progress", "awaiting_input"]);

const blockAttempt = async (
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
    state: "blocked",
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
  await rollUpAttemptTicket(ctx.storage, attempt.ticketId);
  const ticket = await ticketsCollection(ctx.storage).get(attempt.ticketId);
  if (!ticket) throw new Error(`Unknown ticket "${attempt.ticketId}"`);
  await requestHuman(ctx, {
    ticket: attempt.ticketId,
    workspaceId: attempt.workspaceId,
    revision: attempt.revisions.at(-1)?.revision,
    sessionId: input.sessionId,
    reason: input.phase === "review" ? "review-disconnected" : "implementation-disconnected",
    question: `${input.phase} session ${input.sessionId} disconnected again for ${attempt.workspaceShorthand}.`,
    expectedAction: `Inspect the blocker and decide how to recover workspace ${attempt.workspaceShorthand}.`,
    expectedTicketStatusId: ticket.statusId ?? "",
    expectedAttemptState: "blocked",
  });
  return next;
};

const retryImplementation = async (ctx: CommandContext, attempt: AttemptRecord) => {
  await ctx.sessions.followup({
    sessionId: attempt.implementationSessionId,
    prompt: `Resume implementation for ${attempt.workspaceShorthand} after the first disconnect. Keep the same workspace and attempt.`,
  });
  const next = await putAttempt(ctx.storage, {
    ...attempt,
    implementationDisconnectRetries: attempt.implementationDisconnectRetries + 1,
    updatedAt: new Date().toISOString(),
  });
  await appendAttemptEvent(ctx.storage, {
    workspaceId: attempt.workspaceId,
    revision: attempt.revisions.at(-1)?.revision ?? null,
    type: "implementation_resumed",
    actor: actorFromSource(ctx.source, ctx.invocationId),
    sessionId: attempt.implementationSessionId,
    reportId: null,
    reviewId: null,
    threadId: null,
    commitSha: attempt.revisions.at(-1)?.headSha ?? null,
    metadata: { retryCount: next.implementationDisconnectRetries },
  });
  return { decision: "implementation-retried" as const, attempt: next };
};

const appendReviewRetryEvents = async (
  ctx: CommandContext,
  attempt: AttemptRecord,
  disconnected: AttemptReview,
  retry: AttemptReview,
  sessionId: string,
) => {
  const revision = attempt.revisions.at(-1)!;
  await appendAttemptEvent(ctx.storage, {
    id: `review-disconnected:${disconnected.id}`,
    workspaceId: attempt.workspaceId,
    revision: revision.revision,
    type: "review_disconnected",
    actor: actorFromSource(ctx.source, ctx.invocationId),
    sessionId: disconnected.sessionId,
    reportId: null,
    reviewId: disconnected.id,
    threadId: null,
    commitSha: revision.headSha,
    metadata: { retryCount: attempt.reviewDisconnectRetries - 1 },
  });
  await appendAttemptEvent(ctx.storage, {
    id: `review-retried:${retry.id}`,
    workspaceId: attempt.workspaceId,
    revision: revision.revision,
    type: "review_retried",
    actor: retry.reviewer,
    sessionId,
    reportId: null,
    reviewId: retry.id,
    threadId: null,
    commitSha: revision.headSha,
    metadata: { supersedesReviewId: disconnected.id, retryCount: attempt.reviewDisconnectRetries },
  });
};

const attachReviewSession = async (
  ctx: CommandContext,
  attempt: AttemptRecord,
  review: AttemptReview,
  sessionId: string,
) => {
  const revision = attempt.revisions.at(-1)!;
  const attached = { ...review, sessionId };
  const nextRevision = {
    ...revision,
    reviews: revision.reviews.map((candidate) => (candidate.id === review.id ? attached : candidate)),
  };
  const next = await putAttempt(ctx.storage, {
    ...attempt,
    revisions: attempt.revisions.map((candidate) =>
      candidate.revision === revision.revision ? nextRevision : candidate,
    ),
    updatedAt: new Date().toISOString(),
  });
  return { next, attached };
};

const retryReview = async (ctx: CommandContext, attempt: AttemptRecord, review: AttemptReview) => {
  const revision = attempt.revisions.at(-1)!;
  const disconnected = { ...review, state: "disconnected" as const, completedAt: new Date().toISOString() };
  const reviewId = crypto.randomUUID();
  const retry: AttemptReview = {
    ...review,
    id: reviewId,
    reviewer: actorFromSource(ctx.source, ctx.invocationId),
    sessionId: null,
    reportId: null,
    state: "started",
    verdict: null,
    startedAt: new Date().toISOString(),
    completedAt: null,
    supersedesReviewId: review.id,
  };
  const anchors: ResourceAnchor[] = [
    {
      type: "planner-attempt",
      id: attempt.workspaceId,
      label: attempt.workspaceShorthand,
      metadata: {
        ticketId: attempt.ticketId,
        workspaceId: attempt.workspaceId,
        revision: revision.revision,
        headSha: revision.headSha,
        phase: "review",
      },
    },
    {
      type: "planner-review",
      id: reviewId,
      label: `${attempt.ticketShorthand} review retry`,
      metadata: {
        workspaceId: attempt.workspaceId,
        ticketId: attempt.ticketId,
        revision: revision.revision,
        headSha: revision.headSha,
        phase: "review",
      },
    },
  ];
  const nextRevision = {
    ...revision,
    reviews: [...revision.reviews.map((candidate) => (candidate.id === review.id ? disconnected : candidate)), retry],
  };
  const pending = await putAttempt(ctx.storage, {
    ...attempt,
    revisions: attempt.revisions.map((candidate) =>
      candidate.revision === revision.revision ? nextRevision : candidate,
    ),
    reviewDisconnectRetries: attempt.reviewDisconnectRetries + 1,
    updatedAt: retry.startedAt,
  });
  const session = await ctx.sessions.create({
    workspaceId: attempt.workspaceId,
    originalSessionId: review.sessionId ?? undefined,
    title: `Retry review: ${attempt.ticketShorthand} revision ${revision.revision}`,
    anchors,
    template: "review-code",
    vars: {
      ticket: attempt.ticketShorthand,
      workspaceId: attempt.workspaceId,
      reviewId,
      revision: String(revision.revision),
      headSha: revision.headSha,
    },
  });
  await appendReviewRetryEvents(ctx, pending, disconnected, retry, session.id);
  const { next, attached } = await attachReviewSession(ctx, pending, retry, session.id);
  return { decision: "review-retried" as const, attempt: next, review: attached };
};

const reconcileImplementation = async (ctx: CommandContext, attempt: AttemptRecord) => {
  const session = await ctx.sessions.get(attempt.implementationSessionId);
  if (liveStatuses.has(session?.status ?? "")) return { decision: "active" as const, attempt };
  if (session?.status === "disconnected" && attempt.implementationDisconnectRetries === 0) {
    return retryImplementation(ctx, attempt);
  }
  if (session?.status === "disconnected" || session?.status === "failed" || session?.status === "cancelled") {
    const blocked = await blockAttempt(ctx, attempt, {
      phase: "implementation",
      sessionId: attempt.implementationSessionId,
      reason: `Implementation session ended as ${session.status}.`,
      retryCount: attempt.implementationDisconnectRetries,
    });
    return { decision: "blocked" as const, attempt: blocked };
  }
  return { decision: "awaiting-change-request" as const, attempt };
};

const reviewBelongsToClaim = (reviews: readonly AttemptReview[], review: AttemptReview, claimReviewId: string) => {
  const reviewsById = new Map(reviews.map((candidate) => [candidate.id, candidate]));
  let candidate: AttemptReview | undefined = review;
  while (candidate) {
    if (candidate.id === claimReviewId) return true;
    candidate = candidate.supersedesReviewId ? reviewsById.get(candidate.supersedesReviewId) : undefined;
  }
  return false;
};

const markReviewFailed = async (ctx: CommandContext, attempt: AttemptRecord, review: AttemptReview) => {
  const failedReview = { ...review, state: "failed" as const, completedAt: new Date().toISOString() };
  const revision = attempt.revisions.at(-1)!;
  const nextRevision = {
    ...revision,
    reviews: revision.reviews.map((candidate) => (candidate.id === review.id ? failedReview : candidate)),
  };
  const revisions = attempt.revisions.map((candidate) =>
    candidate.revision === revision.revision ? nextRevision : candidate,
  );
  const claims = reviewLaunchClaimsCollection(ctx.storage);
  const claimId = `${attempt.workspaceId}:${revision.revision}`;
  const claim = await claims.get(claimId);
  if (claim && reviewBelongsToClaim(revision.reviews, review, claim.reviewId)) {
    await claims.deleteIfValue(claimId, claim);
  }
  return putAttempt(ctx.storage, {
    ...attempt,
    state: "review_ready",
    revisions,
    updatedAt: failedReview.completedAt,
  });
};

const reconcileReview = async (ctx: CommandContext, attempt: AttemptRecord) => {
  const review = attempt.revisions.at(-1)?.reviews.at(-1);
  if (!review) return { decision: "review-missing-session" as const, attempt };
  if (!review.sessionId) {
    const session = (await ctx.sessions.listByWorkspace(attempt.workspaceId)).find((candidate) =>
      candidate.anchors_json?.some((anchor) => anchor.type === "planner-review" && anchor.id === review.id),
    );
    if (!session) {
      const next = await markReviewFailed(ctx, attempt, review);
      return { decision: "review-missing-session" as const, attempt: next };
    }
    const disconnected = attempt.revisions
      .at(-1)
      ?.reviews.find((candidate) => candidate.id === review.supersedesReviewId);
    if (disconnected) await appendReviewRetryEvents(ctx, attempt, disconnected, review, session.id);
    const { next, attached } = await attachReviewSession(ctx, attempt, review, session.id);
    return { decision: "review-reattached" as const, attempt: next, review: attached };
  }
  const session = await ctx.sessions.get(review.sessionId);
  if (liveStatuses.has(session?.status ?? "")) return { decision: "active" as const, attempt };
  if (session?.status === "disconnected" && attempt.reviewDisconnectRetries === 0) {
    return retryReview(ctx, attempt, review);
  }
  if (session?.status === "disconnected") {
    const blocked = await blockAttempt(ctx, attempt, {
      phase: "review",
      sessionId: review.sessionId,
      reason: `Review session ended as ${session.status}.`,
      retryCount: attempt.reviewDisconnectRetries,
    });
    return { decision: "blocked" as const, attempt: blocked };
  }
  const next = await markReviewFailed(ctx, attempt, review);
  return { decision: "review-missing-verdict" as const, attempt: next };
};

export const reconcileAttemptCommand = defineCommand({
  id: "reconcile-attempt",
  title: "Reconcile managed attempt",
  cli: true,
  params: { workspaceId: params.text({ required: true }) },
  async run(ctx, commandParams) {
    const attempt = await readAttempt(ctx.storage, commandParams.workspaceId);
    if (!attempt) throw new Error(`Unknown managed attempt "${commandParams.workspaceId}"`);
    if (attempt.state === "implementing" || attempt.state === "changes_requested") {
      return reconcileImplementation(ctx, attempt);
    }
    if (attempt.state === "reviewing") return reconcileReview(ctx, attempt);
    return { decision: "unchanged" as const, attempt };
  },
});

export const listAttemptsCommand = defineCommand({
  id: "list-attempts",
  title: "List managed attempts",
  cli: true,
  params: {},
  async run(ctx, _commandParams) {
    return listAttempts(ctx.storage);
  },
});
