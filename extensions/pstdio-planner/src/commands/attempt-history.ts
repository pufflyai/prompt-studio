import { defineCommand, params } from "@pstdio/sdk/extensions";
import { actorFromSource } from "../data/attempt-actors";
import { rollUpAttemptTicket } from "../data/attempt-rollup";
import { deriveRevisionVerdict, paginateAttemptEvents } from "../data/attempt-state";
import {
  appendAttemptEvent,
  attemptEventsCollection,
  attemptSelectionsCollection,
  humanRequestsCollection,
  putAttempt,
  readAttempt,
  reviewCommentsCollection,
  reviewLaunchClaimsCollection,
  reviewThreadsCollection,
} from "../data/attempt-storage";
import type { ReviewComment } from "../data/attempt-types";
import { findTicket } from "../data/resolve";

export const readAttemptHistoryCommand = defineCommand({
  title: "Read attempt history",
  cli: true,
  params: {
    workspaceId: params.text({ required: true }),
    cursor: params.text(),
    limit: params.number(),
  },
  async run(ctx) {
    const attempt = await readAttempt(ctx.storage, ctx.params.workspaceId);
    if (!attempt) throw new Error(`Unknown managed attempt "${ctx.params.workspaceId}"`);
    const events = (await attemptEventsCollection(ctx.storage).list()).filter(
      (event) => event.workspaceId === attempt.workspaceId,
    );
    const page = paginateAttemptEvents(events, ctx.params.cursor, Math.min(100, Math.max(1, ctx.params.limit ?? 50)));
    return { attempt, events: page.items, nextCursor: page.nextCursor };
  },
});

export const readReviewThreadCommand = defineCommand({
  title: "Read review thread",
  cli: true,
  params: {
    threadId: params.text({ required: true }),
    cursor: params.text(),
    limit: params.number(),
  },
  async run(ctx) {
    const thread = await reviewThreadsCollection(ctx.storage).get(ctx.params.threadId);
    if (!thread) throw new Error(`Unknown review thread "${ctx.params.threadId}"`);
    const comments = (await reviewCommentsCollection(ctx.storage).list()).filter(
      (comment) => comment.threadId === thread.id,
    );
    const page = paginateAttemptEvents(comments, ctx.params.cursor, Math.min(100, Math.max(1, ctx.params.limit ?? 50)));
    return { thread, comments: page.items, nextCursor: page.nextCursor };
  },
});

export const addReviewCommentCommand = defineCommand({
  title: "Add review comment",
  cli: true,
  params: {
    workspaceId: params.text({ required: true }),
    reviewId: params.text({ required: true }),
    threadId: params.text({ required: true }),
    body: params.longText({ required: true }),
    replyToCommentId: params.text(),
  },
  async run(ctx) {
    const thread = await reviewThreadsCollection(ctx.storage).get(ctx.params.threadId);
    if (!thread || thread.workspaceId !== ctx.params.workspaceId || thread.reviewId !== ctx.params.reviewId) {
      throw new Error("Review thread does not belong to this review.");
    }
    if (ctx.params.replyToCommentId) {
      const parent = await reviewCommentsCollection(ctx.storage).get(ctx.params.replyToCommentId);
      if (!parent || parent.threadId !== thread.id) throw new Error("Reply target does not belong to this thread.");
    }
    const comment: ReviewComment = {
      id: crypto.randomUUID(),
      reviewId: thread.reviewId,
      threadId: thread.id,
      author: actorFromSource(ctx.source, ctx.invocationId),
      body: ctx.params.body,
      replyToCommentId: ctx.params.replyToCommentId ?? null,
      createdAt: new Date().toISOString(),
      editedAt: null,
    };
    await reviewCommentsCollection(ctx.storage).put(comment.id, comment);
    await appendAttemptEvent(ctx.storage, {
      workspaceId: thread.workspaceId,
      revision: thread.revision,
      type: "comment_added",
      actor: comment.author,
      sessionId: null,
      reportId: null,
      reviewId: thread.reviewId,
      threadId: thread.id,
      commitSha: thread.originalHeadSha,
      metadata: { commentId: comment.id },
    });
    return comment;
  },
});

export const resolveReviewThreadCommand = defineCommand({
  title: "Resolve review thread",
  cli: true,
  params: {
    workspaceId: params.text({ required: true }),
    reviewId: params.text({ required: true }),
    threadId: params.text({ required: true }),
  },
  async run(ctx) {
    const collection = reviewThreadsCollection(ctx.storage);
    const thread = await collection.get(ctx.params.threadId);
    if (!thread || thread.workspaceId !== ctx.params.workspaceId || thread.reviewId !== ctx.params.reviewId) {
      throw new Error("Review thread does not belong to this review.");
    }
    const actor = actorFromSource(ctx.source, ctx.invocationId);
    const next = { ...thread, state: "resolved" as const, resolvedAt: new Date().toISOString(), resolvedBy: actor };
    await collection.put(next.id, next);
    await appendAttemptEvent(ctx.storage, {
      workspaceId: thread.workspaceId,
      revision: thread.revision,
      type: "thread_resolved",
      actor,
      sessionId: null,
      reportId: null,
      reviewId: thread.reviewId,
      threadId: thread.id,
      commitSha: thread.originalHeadSha,
      metadata: {},
    });
    return next;
  },
});

export const dismissReviewCommand = defineCommand({
  title: "Dismiss review",
  cli: true,
  params: {
    workspaceId: params.text({ required: true }),
    reviewId: params.text({ required: true }),
    reason: params.longText({ required: true }),
  },
  async run(ctx) {
    const attempt = await readAttempt(ctx.storage, ctx.params.workspaceId);
    if (!attempt) throw new Error(`Unknown managed attempt "${ctx.params.workspaceId}"`);
    const revision = attempt.revisions.find((candidate) =>
      candidate.reviews.some((review) => review.id === ctx.params.reviewId),
    );
    const review = revision?.reviews.find((candidate) => candidate.id === ctx.params.reviewId);
    if (!revision || !review) throw new Error(`Unknown review "${ctx.params.reviewId}"`);
    const nextRevision = {
      ...revision,
      reviews: revision.reviews.map((candidate) =>
        candidate.id === review.id ? { ...candidate, state: "dismissed" as const } : candidate,
      ),
    };
    const verdict = deriveRevisionVerdict(nextRevision);
    let state: "review_ready" | "approved" | "changes_requested" = "review_ready";
    if (verdict === "passed") state = "approved";
    if (verdict === "changes_requested") state = "changes_requested";
    const revisions = attempt.revisions.map((candidate) =>
      candidate.revision === revision.revision ? nextRevision : candidate,
    );
    const next = await putAttempt(ctx.storage, { ...attempt, state, revisions, updatedAt: new Date().toISOString() });
    await appendAttemptEvent(ctx.storage, {
      workspaceId: attempt.workspaceId,
      revision: revision.revision,
      type: "review_dismissed",
      actor: actorFromSource(ctx.source, ctx.invocationId),
      sessionId: review.sessionId,
      reportId: review.reportId,
      reviewId: review.id,
      threadId: null,
      commitSha: review.reviewedHeadSha,
      metadata: { reason: ctx.params.reason },
    });
    await reviewLaunchClaimsCollection(ctx.storage).delete(`${attempt.workspaceId}:${revision.revision}`);
    await rollUpAttemptTicket(ctx.storage, attempt.ticketId);
    return next;
  },
});

export const selectAttemptCommand = defineCommand({
  title: "Select ticket attempt",
  cli: true,
  params: {
    ticket: params.text({ required: true }),
    workspaceId: params.text({ required: true }),
    humanRequestId: params.text(),
  },
  async run(ctx) {
    if (ctx.source === "schedule" || ctx.source === "automation" || ctx.source === "event") {
      throw new Error("Automation cannot select an attempt.");
    }
    const ticket = await findTicket(ctx.storage, ctx.params.ticket);
    const attempt = await readAttempt(ctx.storage, ctx.params.workspaceId);
    if (!ticket || !attempt || attempt.ticketId !== ticket.id)
      throw new Error("Workspace is not an attempt for this ticket.");
    if (ctx.params.humanRequestId) {
      const request = await humanRequestsCollection(ctx.storage).get(ctx.params.humanRequestId);
      if (!request || request.ticketId !== ticket.id || request.state !== "open") {
        throw new Error("The human request does not match this ticket.");
      }
    }
    const selection = {
      ticketId: ticket.id,
      workspaceId: attempt.workspaceId,
      selectedBy: actorFromSource(ctx.source, ctx.invocationId),
      humanRequestId: ctx.params.humanRequestId ?? null,
      selectedAt: new Date().toISOString(),
    };
    await attemptSelectionsCollection(ctx.storage).put(ticket.id, selection);
    await appendAttemptEvent(ctx.storage, {
      workspaceId: attempt.workspaceId,
      revision: attempt.revisions.at(-1)?.revision ?? null,
      type: "attempt_selected",
      actor: selection.selectedBy,
      sessionId: null,
      reportId: null,
      reviewId: null,
      threadId: null,
      commitSha: attempt.revisions.at(-1)?.headSha ?? null,
      metadata: { humanRequestId: selection.humanRequestId },
    });
    return selection;
  },
});
