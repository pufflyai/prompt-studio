import { defineCommand, l10n, params, type ResourceAnchor } from "@pstdio/sdk/extensions";
import { actorFromSource } from "../data/attempt-actors";
import { appendAttemptEvent, putAttempt, readAttempt, reviewLaunchClaimsCollection } from "../data/attempt-storage";
import type { AttemptReview } from "../data/attempt-types";

const workspaceIdFrom = (
  ctx: {
    resource?: { type: string; id: string; metadata?: Record<string, unknown> };
  },
  commandParams: { workspaceId?: string },
) => {
  const workspaceId = commandParams.workspaceId?.trim();
  if (workspaceId) return workspaceId;
  if (ctx.resource?.type !== "workspace") throw new Error("Workspace is required.");
  const metadataId = ctx.resource.metadata?.workspaceId;
  return typeof metadataId === "string" ? metadataId : ctx.resource.id;
};

export const runReviewCommand = defineCommand({
  title: l10n("commands.runReview.title", "Run review"),
  cli: true,
  menus: [
    {
      target: "workbench.nav.overflow",
      label: l10n("commands.runReview.menuLabel", "Run review"),
      icon: "clipboard-check",
      when: { resourceType: ["workspace"] },
    },
  ],
  params: {
    workspaceId: params.text({ label: "Workspace", required: false }),
    harness: params.harness({ label: "Harness", required: false }),
  },
  async run(ctx, commandParams) {
    const workspaceId = workspaceIdFrom(ctx, commandParams);
    const attempt = await readAttempt(ctx.storage, workspaceId);
    if (!attempt) throw new Error(`Unknown managed attempt "${workspaceId}"`);
    const revision = attempt.revisions.at(-1);
    if (!revision) throw new Error("The attempt has no submitted revision.");
    if (attempt.state !== "review_ready") throw new Error("The attempt revision is not ready for review.");

    const reviewId = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const claimId = `${workspaceId}:${revision.revision}`;
    const claims = reviewLaunchClaimsCollection(ctx.storage);
    if (
      !(await claims.createIfAbsent(claimId, {
        workspaceId,
        revision: revision.revision,
        reviewId,
        createdAt: timestamp,
      }))
    ) {
      throw new Error("A review is already running or completed for this revision.");
    }
    const review: AttemptReview = {
      id: reviewId,
      sessionId: null,
      reportId: null,
      reviewedHeadSha: revision.headSha,
      reviewer: actorFromSource(ctx.source, ctx.invocationId),
      state: "started",
      verdict: null,
      startedAt: timestamp,
      completedAt: null,
      supersedesReviewId: null,
    };
    const anchors: ResourceAnchor[] = [
      {
        type: "planner-review",
        id: reviewId,
        label: `${attempt.ticketShorthand} review ${revision.revision}`,
        metadata: {
          workspaceId,
          ticketId: attempt.ticketId,
          revision: revision.revision,
          headSha: revision.headSha,
          phase: "review",
        },
      },
      {
        type: "planner-attempt",
        id: workspaceId,
        label: attempt.workspaceShorthand,
        metadata: {
          workspaceId,
          ticketId: attempt.ticketId,
          revision: revision.revision,
          headSha: revision.headSha,
          phase: "review",
        },
      },
    ];

    try {
      const session = await ctx.sessions.create({
        workspaceId,
        title: `Code review: ${attempt.ticketShorthand} revision ${revision.revision}`,
        anchors,
        harness: commandParams.harness,
        template: "review-code",
        vars: {
          ticket: attempt.ticketShorthand,
          workspaceId,
          reviewId,
          revision: String(revision.revision),
          headSha: revision.headSha,
        },
      });
      review.sessionId = session.id;
      const revisions = attempt.revisions.map((candidate) =>
        candidate.revision === revision.revision
          ? { ...candidate, reviews: [...candidate.reviews, review] }
          : candidate,
      );
      await putAttempt(ctx.storage, { ...attempt, state: "reviewing", revisions, updatedAt: timestamp });
      await appendAttemptEvent(ctx.storage, {
        workspaceId,
        revision: revision.revision,
        type: "review_started",
        actor: review.reviewer,
        sessionId: session.id,
        reportId: null,
        reviewId,
        threadId: null,
        commitSha: revision.headSha,
        metadata: {},
      });
      return { review, session };
    } catch (error) {
      review.state = "failed";
      review.completedAt = new Date().toISOString();
      const revisions = attempt.revisions.map((candidate) =>
        candidate.revision === revision.revision
          ? { ...candidate, reviews: [...candidate.reviews, review] }
          : candidate,
      );
      await putAttempt(ctx.storage, { ...attempt, revisions, updatedAt: review.completedAt });
      await claims.delete(claimId);
      throw error;
    }
  },
});
