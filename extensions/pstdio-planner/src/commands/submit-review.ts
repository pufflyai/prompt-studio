import { type CommandContext, defineCommand, params } from "@pstdio/sdk/extensions";
import { actorFromSource } from "../data/attempt-actors";
import { rollUpAttemptTicket } from "../data/attempt-rollup";
import { deriveRevisionVerdict } from "../data/attempt-state";
import {
  appendAttemptEvent,
  putAttempt,
  readAttempt,
  reviewCommentsCollection,
  reviewThreadsCollection,
} from "../data/attempt-storage";
import type { AttemptReview, ReviewComment, ReviewThread } from "../data/attempt-types";
import { ticketsCollection } from "../data/collections";
import { readReport, workspaceHead } from "./change-requests";
import { requestHuman } from "./human-requests";

export interface ReviewFinding {
  path?: string;
  startLine?: number;
  endLine?: number;
  side?: "base" | "head";
  severity: "critical" | "minor" | "suggestion";
  body: string;
}

const validateReviewFindings = (value: unknown, verdict: "passed" | "changes_requested") => {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("Review threads must be a JSON array.");
  const findings = value as ReviewFinding[];
  const severities = new Set(["critical", "minor", "suggestion"]);
  for (const finding of findings) {
    if (!finding || typeof finding !== "object" || !severities.has(finding.severity) || !finding.body?.trim()) {
      throw new Error("Each review finding requires a severity and body.");
    }
    const location = [finding.path, finding.startLine, finding.endLine, finding.side];
    const hasLocation = location.some((part) => part !== undefined);
    const hasCompleteLocation =
      typeof finding.path === "string" &&
      finding.path.length > 0 &&
      typeof finding.startLine === "number" &&
      finding.startLine > 0 &&
      typeof finding.endLine === "number" &&
      finding.endLine >= finding.startLine &&
      (finding.side === "base" || finding.side === "head");
    if (hasLocation && !hasCompleteLocation) {
      throw new Error("Inline review findings require a valid path, line range, and side.");
    }
  }
  if (verdict === "passed" && findings.some((finding) => finding.severity !== "suggestion")) {
    throw new Error("A passed review cannot contain critical or minor findings.");
  }
  return findings;
};

const attemptStateFromVerdict = (verdict: ReturnType<typeof deriveRevisionVerdict>) => {
  if (verdict === "passed") return "approved" as const;
  if (verdict === "changes_requested") return "changes_requested" as const;
  return "review_ready" as const;
};

const createFinding = async (
  ctx: CommandContext,
  input: {
    finding: ReviewFinding;
    workspaceId: string;
    revision: number;
    reviewId: string;
    baseSha: string;
    headSha: string;
  },
) => {
  const { finding } = input;
  const hasLocation = finding.path !== undefined;
  if (hasLocation && (!finding.startLine || !finding.endLine || !finding.side)) {
    throw new Error("Inline review findings require a path, line range, and side.");
  }
  const timestamp = new Date().toISOString();
  const actor = actorFromSource(ctx.source, ctx.invocationId);
  const thread: ReviewThread = {
    id: crypto.randomUUID(),
    workspaceId: input.workspaceId,
    revision: input.revision,
    reviewId: input.reviewId,
    path: finding.path ?? null,
    startLine: finding.startLine ?? null,
    endLine: finding.endLine ?? null,
    side: finding.side ?? null,
    originalBaseSha: input.baseSha,
    originalHeadSha: input.headSha,
    severity: finding.severity,
    state: "open",
    createdAt: timestamp,
    resolvedAt: null,
    resolvedBy: null,
  };
  const comment: ReviewComment = {
    id: crypto.randomUUID(),
    reviewId: input.reviewId,
    threadId: thread.id,
    author: actor,
    body: finding.body,
    replyToCommentId: null,
    createdAt: timestamp,
    editedAt: null,
  };
  await reviewThreadsCollection(ctx.storage).put(thread.id, thread);
  await reviewCommentsCollection(ctx.storage).put(comment.id, comment);
  await appendAttemptEvent(ctx.storage, {
    workspaceId: input.workspaceId,
    revision: input.revision,
    type: "thread_created",
    actor,
    sessionId: null,
    reportId: null,
    reviewId: input.reviewId,
    threadId: thread.id,
    commitSha: input.headSha,
    metadata: { severity: finding.severity, path: finding.path ?? null },
  });
  return { thread, comment };
};

export const submitReviewCommand = defineCommand({
  id: "submit-review",
  title: "Submit review verdict",
  cli: true,
  params: {
    workspaceId: params.text({ required: true }),
    reviewId: params.text({ required: true }),
    reviewSessionId: params.text(),
    sessionId: params.text(),
    reviewedHeadSha: params.text({ required: true }),
    reviewReportId: params.text({ required: true }),
    verdict: params.select({
      required: true,
      options: [
        { label: "Passed", value: "passed" },
        { label: "Changes requested", value: "changes_requested" },
      ],
    }),
    expectedRevision: params.number({ required: true }),
    threads: params.json<ReviewFinding[]>(),
  },
  async run(ctx, commandParams) {
    if (commandParams.verdict !== "passed" && commandParams.verdict !== "changes_requested") {
      throw new Error(`Unknown review verdict "${commandParams.verdict}"`);
    }
    const reviewFindings = validateReviewFindings(commandParams.threads, commandParams.verdict);
    const attempt = await readAttempt(ctx.storage, commandParams.workspaceId);
    if (!attempt) throw new Error(`Unknown managed attempt "${commandParams.workspaceId}"`);
    const revision = attempt.revisions.find((candidate) => candidate.revision === commandParams.expectedRevision);
    if (!revision || revision !== attempt.revisions.at(-1))
      throw new Error("Attempt revision changed before review submission.");
    const review = revision.reviews.find((candidate) => candidate.id === commandParams.reviewId);
    const reviewSessionId = commandParams.reviewSessionId ?? commandParams.sessionId;
    if (!reviewSessionId || !review || review.state !== "started" || review.sessionId !== reviewSessionId) {
      throw new Error("The review session does not own this review round.");
    }
    const head = await workspaceHead(ctx, attempt.workspaceId);
    if (head !== revision.headSha || head !== commandParams.reviewedHeadSha) {
      throw new Error("Workspace HEAD changed before review submission.");
    }
    const report = await readReport(ctx, commandParams.reviewReportId);
    if (report.id !== commandParams.reviewReportId || report.workspaceId !== attempt.workspaceId || report.draft) {
      throw new Error("The saved review report does not belong to this workspace.");
    }

    const completedAt = new Date().toISOString();
    const submitted: AttemptReview = {
      ...review,
      state: "submitted" as const,
      reportId: commandParams.reviewReportId,
      verdict: commandParams.verdict,
      completedAt,
    };
    const nextRevision = {
      ...revision,
      reviews: revision.reviews.map((candidate) => (candidate.id === review.id ? submitted : candidate)),
    };
    const result = deriveRevisionVerdict(nextRevision);
    const nextState = attemptStateFromVerdict(result);
    const revisions = attempt.revisions.map((candidate) =>
      candidate.revision === nextRevision.revision ? nextRevision : candidate,
    );
    const next = await putAttempt(ctx.storage, { ...attempt, state: nextState, revisions, updatedAt: completedAt });

    const findings = [];
    for (const finding of reviewFindings) {
      findings.push(
        await createFinding(ctx, {
          finding,
          workspaceId: attempt.workspaceId,
          revision: revision.revision,
          reviewId: review.id,
          baseSha: revision.baseSha,
          headSha: revision.headSha,
        }),
      );
    }
    await appendAttemptEvent(ctx.storage, {
      workspaceId: attempt.workspaceId,
      revision: revision.revision,
      type: "review_submitted",
      actor: submitted.reviewer,
      sessionId: submitted.sessionId,
      reportId: submitted.reportId,
      reviewId: submitted.id,
      threadId: null,
      commitSha: revision.headSha,
      metadata: { verdict: commandParams.verdict },
    });
    await rollUpAttemptTicket(ctx.storage, attempt.ticketId);

    if (commandParams.verdict === "changes_requested") {
      await ctx.sessions.followup({
        sessionId: attempt.implementationSessionId,
        prompt: `Review ${review.id} requested changes for ${attempt.workspaceShorthand} at ${revision.headSha}. Read report ${submitted.reportId} and address its findings.`,
      });
      await appendAttemptEvent(ctx.storage, {
        workspaceId: attempt.workspaceId,
        revision: revision.revision,
        type: "implementation_resumed",
        actor: submitted.reviewer,
        sessionId: attempt.implementationSessionId,
        reportId: submitted.reportId,
        reviewId: submitted.id,
        threadId: null,
        commitSha: revision.headSha,
        metadata: {},
      });
    } else if (result === "passed") {
      const currentTicket = await ticketsCollection(ctx.storage).get(attempt.ticketId);
      if (!currentTicket) throw new Error(`Unknown ticket "${attempt.ticketId}"`);
      await requestHuman(ctx, {
        ticket: attempt.ticketId,
        workspaceId: attempt.workspaceId,
        revision: revision.revision,
        sessionId: attempt.implementationSessionId,
        reason: "approved-revision",
        question: `${attempt.workspaceShorthand} revision ${revision.revision} is approved at ${revision.headSha}.`,
        expectedAction: `Select, merge, or otherwise handle approved workspace ${attempt.workspaceShorthand}. Review report: ${submitted.reportId}.`,
        expectedTicketStatusId: currentTicket.statusId ?? "",
        expectedAttemptState: "approved",
      });
    }

    return { attempt: next, review: submitted, findings };
  },
});
