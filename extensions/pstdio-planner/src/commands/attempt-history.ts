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
  id: "read-attempt-history",
  title: "Read attempt history",
  cli: true,
  params: {
    workspaceId: params.text({ required: true }),
    cursor: params.text(),
    limit: params.number(),
  },
  async run(ctx, commandParams) {
    const attempt = await readAttempt(ctx.storage, commandParams.workspaceId);
    if (!attempt) throw new Error(`Unknown managed attempt "${commandParams.workspaceId}"`);
    const events = (await attemptEventsCollection(ctx.storage).list()).filter(
      (event) => event.workspaceId === attempt.workspaceId,
    );
    const page = paginateAttemptEvents(
      events,
      commandParams.cursor,
      Math.min(100, Math.max(1, commandParams.limit ?? 50)),
    );
    return { attempt, events: page.items, nextCursor: page.nextCursor };
  },
});

export const readReviewThreadCommand = defineCommand({
  id: "read-review-thread",
  title: "Read review thread",
  cli: true,
  params: {
    threadId: params.text({ required: true }),
    cursor: params.text(),
    limit: params.number(),
  },
  async run(ctx, commandParams) {
    const thread = await reviewThreadsCollection(ctx.storage).get(commandParams.threadId);
    if (!thread) throw new Error(`Unknown review thread "${commandParams.threadId}"`);
    const comments = (await reviewCommentsCollection(ctx.storage).list()).filter(
      (comment) => comment.threadId === thread.id,
    );
    const page = paginateAttemptEvents(
      comments,
      commandParams.cursor,
      Math.min(100, Math.max(1, commandParams.limit ?? 50)),
    );
    return { thread, comments: page.items, nextCursor: page.nextCursor };
  },
});

export const addReviewCommentCommand = defineCommand({
  id: "add-review-comment",
  title: "Add review comment",
  cli: true,
  params: {
    workspaceId: params.text({ required: true }),
    reviewId: params.text({ required: true }),
    threadId: params.text({ required: true }),
    body: params.longText({ required: true }),
    replyToCommentId: params.text(),
  },
  async run(ctx, commandParams) {
    const thread = await reviewThreadsCollection(ctx.storage).get(commandParams.threadId);
    if (!thread || thread.workspaceId !== commandParams.workspaceId || thread.reviewId !== commandParams.reviewId) {
      throw new Error("Review thread does not belong to this review.");
    }
    if (commandParams.replyToCommentId) {
      const parent = await reviewCommentsCollection(ctx.storage).get(commandParams.replyToCommentId);
      if (!parent || parent.threadId !== thread.id) throw new Error("Reply target does not belong to this thread.");
    }
    const comment: ReviewComment = {
      id: crypto.randomUUID(),
      reviewId: thread.reviewId,
      threadId: thread.id,
      author: actorFromSource(ctx.source, ctx.invocationId),
      body: commandParams.body,
      replyToCommentId: commandParams.replyToCommentId ?? null,
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
  id: "resolve-review-thread",
  title: "Resolve review thread",
  cli: true,
  params: {
    workspaceId: params.text({ required: true }),
    reviewId: params.text({ required: true }),
    threadId: params.text({ required: true }),
  },
  async run(ctx, commandParams) {
    const collection = reviewThreadsCollection(ctx.storage);
    const thread = await collection.get(commandParams.threadId);
    if (!thread || thread.workspaceId !== commandParams.workspaceId || thread.reviewId !== commandParams.reviewId) {
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
  id: "dismiss-review",
  title: "Dismiss review",
  cli: true,
  params: {
    workspaceId: params.text({ required: true }),
    reviewId: params.text({ required: true }),
    reason: params.longText({ required: true }),
  },
  async run(ctx, commandParams) {
    const attempt = await readAttempt(ctx.storage, commandParams.workspaceId);
    if (!attempt) throw new Error(`Unknown managed attempt "${commandParams.workspaceId}"`);
    const revision = attempt.revisions.find((candidate) =>
      candidate.reviews.some((review) => review.id === commandParams.reviewId),
    );
    const review = revision?.reviews.find((candidate) => candidate.id === commandParams.reviewId);
    if (!revision || !review) throw new Error(`Unknown review "${commandParams.reviewId}"`);
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
      metadata: { reason: commandParams.reason },
    });
    await reviewLaunchClaimsCollection(ctx.storage).delete(`${attempt.workspaceId}:${revision.revision}`);
    await rollUpAttemptTicket(ctx.storage, attempt.ticketId);
    return next;
  },
});

export const selectAttemptCommand = defineCommand({
  id: "select-attempt",
  title: "Select ticket attempt",
  cli: true,
  params: {
    ticket: params.text({ required: true }),
    workspaceId: params.text({ required: true }),
    humanRequestId: params.text(),
  },
  async run(ctx, commandParams) {
    if (ctx.source === "schedule" || ctx.source === "automation" || ctx.source === "event") {
      throw new Error("Automation cannot select an attempt.");
    }
    const ticket = await findTicket(ctx.storage, commandParams.ticket);
    const attempt = await readAttempt(ctx.storage, commandParams.workspaceId);
    if (!ticket || !attempt || attempt.ticketId !== ticket.id)
      throw new Error("Workspace is not an attempt for this ticket.");
    if (commandParams.humanRequestId) {
      const request = await humanRequestsCollection(ctx.storage).get(commandParams.humanRequestId);
      if (!request || request.ticketId !== ticket.id || request.state !== "open") {
        throw new Error("The human request does not match this ticket.");
      }
    }
    const selection = {
      ticketId: ticket.id,
      workspaceId: attempt.workspaceId,
      selectedBy: actorFromSource(ctx.source, ctx.invocationId),
      humanRequestId: commandParams.humanRequestId ?? null,
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
