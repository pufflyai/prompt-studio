import { type CommandContext, commandRef, defineCommand, params } from "@pstdio/sdk/extensions";
import { actorFromSource } from "../data/attempt-actors";
import { rollUpAttemptTicket } from "../data/attempt-rollup";
import { appendRevision } from "../data/attempt-state";
import { appendAttemptEvent, putAttempt, readAttempt, reviewThreadsCollection } from "../data/attempt-storage";
import type { AttemptRecord } from "../data/attempt-types";
import { inlineThreadIsOutdated } from "../data/thread-mapping";

const reportsCommand = commandRef.forExtension({ publisher: "pstdio", name: "pstdio-reports" });
const readReportCommand = reportsCommand<{ id: string }, { id?: string; workspaceId?: string | null; draft?: boolean }>(
  "reports.read",
);

export const readReport = async (ctx: Pick<CommandContext, "commands">, reportId: string) => {
  const outcome = await ctx.commands.execute(readReportCommand, { params: { id: reportId } });
  if (!outcome.ok) throw new Error(`Unknown report "${reportId}": ${outcome.reason}`);
  return outcome.value;
};

export const workspaceGitPath = async (ctx: CommandContext, workspaceId: string) => {
  const workspace = await ctx.workspaces.get(workspaceId);
  if (!workspace) throw new Error(`Unknown workspace "${workspaceId}"`);
  const repo = workspace.worktree_path ? null : await ctx.repos.getDefault();
  const path = workspace.worktree_path ?? repo?.path;
  if (!path) throw new Error(`Workspace "${workspaceId}" has no repository path.`);
  return path;
};

export const workspaceHead = async (ctx: CommandContext, workspaceId: string) => {
  const path = await workspaceGitPath(ctx, workspaceId);
  const result = await ctx.process.run({ command: ["git", "-C", path, "rev-parse", "HEAD"] });
  if (result.exitCode !== 0) throw new Error(result.stderr.trim() || "Could not read workspace HEAD.");
  return result.stdout.trim();
};

const mapOpenThreads = async (ctx: CommandContext, attempt: AttemptRecord, nextHeadSha: string) => {
  const collection = reviewThreadsCollection(ctx.storage);
  const threads = (await collection.list()).filter(
    (thread) =>
      thread.workspaceId === attempt.workspaceId &&
      thread.state === "open" &&
      thread.side === "head" &&
      thread.path !== null &&
      thread.startLine !== null &&
      thread.endLine !== null &&
      thread.originalHeadSha !== nextHeadSha,
  );
  if (threads.length === 0) return;
  const path = await workspaceGitPath(ctx, attempt.workspaceId);
  for (const thread of threads) {
    const result = await ctx.process.run({
      command: ["git", "-C", path, "diff", "--unified=0", thread.originalHeadSha, nextHeadSha, "--", thread.path!],
    });
    const outdated =
      result.exitCode !== 0 ||
      inlineThreadIsOutdated({ startLine: thread.startLine!, endLine: thread.endLine!, diff: result.stdout });
    if (!outdated) continue;
    const next = { ...thread, state: "outdated" as const };
    await collection.put(next.id, next);
    await appendAttemptEvent(ctx.storage, {
      workspaceId: attempt.workspaceId,
      revision: attempt.revisions.at(-1)?.revision ?? null,
      type: "thread_outdated",
      actor: actorFromSource(ctx.source, ctx.invocationId),
      sessionId: attempt.implementationSessionId,
      reportId: null,
      reviewId: thread.reviewId,
      threadId: thread.id,
      commitSha: nextHeadSha,
      metadata: { path: thread.path, startLine: thread.startLine, endLine: thread.endLine },
    });
  }
};

export const submitChangeRequestCommand = defineCommand({
  id: "submit-change-request",
  title: "Submit change request",
  cli: true,
  params: {
    workspaceId: params.text({ required: true }),
    implementationSessionId: params.text(),
    sessionId: params.text(),
    headSha: params.text({ required: true }),
    changeRequestReportId: params.text({ required: true }),
    expectedAttemptState: params.select({
      required: true,
      options: [
        { label: "Implementing", value: "implementing" },
        { label: "Changes requested", value: "changes_requested" },
      ],
    }),
  },
  async run(ctx, commandParams) {
    const attempt = await readAttempt(ctx.storage, commandParams.workspaceId);
    if (!attempt) throw new Error(`Unknown managed attempt "${commandParams.workspaceId}"`);
    const implementationSessionId = commandParams.implementationSessionId ?? commandParams.sessionId;
    if (!implementationSessionId || attempt.implementationSessionId !== implementationSessionId) {
      throw new Error("The implementation session does not own this attempt.");
    }
    if (attempt.state !== commandParams.expectedAttemptState)
      throw new Error("Attempt state changed before submission.");
    const currentHead = await workspaceHead(ctx, attempt.workspaceId);
    if (currentHead !== commandParams.headSha) throw new Error("Workspace HEAD changed before submission.");
    const report = await readReport(ctx, commandParams.changeRequestReportId);
    if (
      report.id !== commandParams.changeRequestReportId ||
      report.workspaceId !== attempt.workspaceId ||
      report.draft
    ) {
      throw new Error("The saved change request report does not belong to this workspace.");
    }

    const timestamp = new Date().toISOString();
    const revisions = appendRevision(attempt.revisions, {
      baseSha: attempt.base.headSha,
      headSha: currentHead,
      changeRequestReportId: commandParams.changeRequestReportId,
      submittedAt: timestamp,
      submittedBy: actorFromSource(ctx.source, ctx.invocationId),
    });
    if (revisions === attempt.revisions) return attempt;
    const revision = revisions.at(-1)!;
    await mapOpenThreads(ctx, attempt, currentHead);
    const next = await putAttempt(ctx.storage, {
      ...attempt,
      state: "review_ready",
      revisions,
      blocker: null,
      updatedAt: timestamp,
    });
    await appendAttemptEvent(ctx.storage, {
      workspaceId: attempt.workspaceId,
      revision: revision.revision,
      type: "revision_submitted",
      actor: revision.submittedBy,
      sessionId: attempt.implementationSessionId,
      reportId: revision.changeRequestReportId,
      reviewId: null,
      threadId: null,
      commitSha: revision.headSha,
      metadata: {},
    });
    await rollUpAttemptTicket(ctx.storage, attempt.ticketId);
    return next;
  },
});
