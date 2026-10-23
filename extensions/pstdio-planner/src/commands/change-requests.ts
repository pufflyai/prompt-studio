import type { ParamsOf } from "@pstdio/sdk/extensions";
import { type CommandContext, commandRef, defineCommand, l10n, params } from "@pstdio/sdk/extensions";
import { actorFromSource } from "../data/attempt-actors";
import { legacyAttemptOutput } from "../data/attempt-compatibility";
import { appendRevision } from "../data/attempt-state";
import { appendAttemptEvent, putAttempt, readAttempt, reviewThreadsCollection } from "../data/attempt-storage";
import type { AttemptRecord } from "../data/attempt-types";
import { hasPendingImplementationInput } from "../data/implementation-input";
import { listTicketReviewRequests } from "../data/review-request-storage";
import { readSessionHistory } from "../data/session-history";
import { inlineThreadIsOutdated } from "../data/thread-mapping";
import { withWriteGuard } from "../data/write-guard";
import { validateSubmittedStack } from "./stack-validation";

const reportsCommand = commandRef.forExtension({ publisher: "pstdio", name: "pstdio-reports" });
const readReportCommand = reportsCommand<{ id: string }, { id?: string; workspaceId?: string | null; draft?: boolean }>(
  "reports.read",
);

export const readReport = async (ctx: Pick<CommandContext, "commands">, reportId: string) => {
  const outcome = await ctx.commands.execute(readReportCommand, { params: { id: reportId } });
  if (!outcome.ok) throw new Error(`Unknown report "${reportId}": ${outcome.reason}`);
  return outcome.value;
};

export class WorkspaceUnavailableError extends Error {}

export const workspaceGitPath = async (ctx: CommandContext, workspaceId: string) => {
  const workspace = await ctx.workspaces.get(workspaceId);
  if (!workspace) throw new WorkspaceUnavailableError(`Unknown workspace "${workspaceId}"`);
  if (workspace.execution_kind !== "local" || !workspace.provider_capabilities_json?.diff)
    throw new WorkspaceUnavailableError("This workspace does not support Git attempts.");
  const path = workspace.root_path;
  if (!path) throw new WorkspaceUnavailableError(`Workspace "${workspaceId}" has no repository path.`);
  return path;
};

export const workspaceHead = async (ctx: CommandContext, workspaceId: string) => {
  const path = await workspaceGitPath(ctx, workspaceId);
  const result = await ctx.process.run({ command: ["git", "-C", path, "rev-parse", "HEAD"] });
  if (result.exitCode !== 0)
    throw new WorkspaceUnavailableError(result.stderr.trim() || "Could not read workspace HEAD.");
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

const submissionParams = {
  workspaceId: params.text({ required: true }),
  implementationSessionId: params.text(),
  sessionId: params.text(),
  headSha: params.text({ required: true }),
  changeRequestReportId: params.text({ required: true }),
  /** @deprecated Ownership and expectedRevision replace the attempt-state gate. */
  expectedAttemptState: params.select({
    description: l10n(
      "attempts.expectedAttemptState.deprecated",
      "Deprecated in 0.44. Use ownership checks and expectedRevision. Removed in 0.45.",
    ),
    options: [
      { label: "Implementing", value: "implementing" },
      { label: "Changes requested", value: "changes_requested" },
    ],
  }),
  expectedRevision: params.number(),
};

async function submitRevision(ctx: CommandContext, commandParams: ParamsOf<typeof submissionParams>) {
  const attempt = await readAttempt(ctx.storage, commandParams.workspaceId);
  if (!attempt) throw new Error(`Unknown managed attempt "${commandParams.workspaceId}"`);
  const implementationSessionId = commandParams.implementationSessionId ?? commandParams.sessionId;
  if (!implementationSessionId || attempt.implementationSessionId !== implementationSessionId) {
    throw new Error("The implementation session does not own this attempt.");
  }
  if (
    !(await readSessionHistory(ctx.sessions, { workspaceId: attempt.workspaceId })).some(
      ({ id }) => id === implementationSessionId,
    )
  )
    throw new Error("The implementation session is not linked to this workspace.");
  const currentHead = await workspaceHead(ctx, attempt.workspaceId);
  if (currentHead !== commandParams.headSha) throw new Error("Workspace HEAD changed before submission.");
  if (hasPendingImplementationInput(await listTicketReviewRequests(ctx.storage, attempt.ticketId)))
    throw new Error("Resolve implementation input before submitting a handoff.");
  const previous = attempt.revisions.at(-1);
  const path = await workspaceGitPath(ctx, attempt.workspaceId);
  const base = await validateSubmittedStack(ctx, attempt, path, currentHead);
  if (
    previous?.headSha === currentHead &&
    previous.baseSha === base.headSha &&
    previous.changeRequestReportId === commandParams.changeRequestReportId
  )
    return attempt;
  if (commandParams.expectedRevision !== undefined && commandParams.expectedRevision !== (previous?.revision ?? 0))
    throw new Error("Attempt revision changed before submission.");
  const report = await readReport(ctx, commandParams.changeRequestReportId);
  if (report.id !== commandParams.changeRequestReportId || report.workspaceId !== attempt.workspaceId || report.draft) {
    throw new Error("The saved change request report does not belong to this workspace.");
  }

  const timestamp = new Date().toISOString();
  const revisions = appendRevision(attempt.revisions, {
    baseSha: base.headSha,
    headSha: currentHead,
    changeRequestReportId: commandParams.changeRequestReportId,
    submittedAt: timestamp,
    submittedBy: actorFromSource(ctx.source, ctx.invocationId),
  });
  if (revisions === attempt.revisions) return attempt;
  const revision = revisions.at(-1)!;
  const finalBase = await validateSubmittedStack(ctx, attempt, path, currentHead);
  if (finalBase.headSha !== base.headSha || finalBase.workspaceId !== base.workspaceId)
    throw new Error("The dependency revision changed before submission. Query and submit again.");
  if ((await workspaceHead(ctx, attempt.workspaceId)) !== currentHead)
    throw new Error("Workspace HEAD changed before submission.");
  const next = await putAttempt(ctx.storage, {
    ...attempt,
    base,
    revisions,
    blocker: null,
    updatedAt: timestamp,
  });
  await mapOpenThreads(ctx, attempt, currentHead);
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
  return next;
}

export const submitChangeRequestCommand = defineCommand({
  id: "submit-change-request",
  title: "Submit change request",
  cli: true,
  params: submissionParams,
  async run(ctx, commandParams) {
    const variant = await withWriteGuard(ctx, `attempt:${commandParams.workspaceId}`, () =>
      submitRevision(ctx, commandParams),
    );
    return legacyAttemptOutput(ctx.storage, variant);
  },
});
