import type { ExtensionContextBase, MergePayload } from "@pstdio/sdk/extensions";
import { actorFromSource } from "./attempt-actors";
import { appendAttemptEvent, readAttempt } from "./attempt-storage";
import type { AttemptRecord } from "./attempt-types";

export const recordAttemptMerge = async (ctx: ExtensionContextBase, payload: MergePayload) => {
  const attempt = payload.workspace ? await readAttempt(ctx.storage, payload.workspace.id) : null;
  const revision = attempt?.revisions.at(-1);
  if (!attempt || !revision) return;
  let commitSha = payload.commitSha;
  if (!commitSha) {
    const path = payload.repoPath ?? (await ctx.workspaces.getDefault())?.root_path;
    if (!path) throw new Error("The merge has no target Git folder.");
    const result = await ctx.process.run({ command: ["git", "-C", path, "rev-parse", "HEAD"] });
    if (result.exitCode !== 0) throw new Error(result.stderr);
    commitSha = result.stdout.trim();
  }
  await recordSubmittedMerge(ctx, attempt, commitSha);
};

export const recordSubmittedMerge = async (ctx: ExtensionContextBase, attempt: AttemptRecord, commitSha: string) => {
  const revision = attempt.revisions.at(-1);
  if (!revision) return;
  await appendAttemptEvent(ctx.storage, {
    id: `attempt-merged:${attempt.workspaceId}:${revision.headSha}:${commitSha}`,
    workspaceId: attempt.workspaceId,
    revision: revision.revision,
    type: "attempt_merged",
    actor: actorFromSource(ctx.source),
    sessionId: attempt.implementationSessionId,
    reportId: revision.changeRequestReportId,
    reviewId: null,
    threadId: null,
    commitSha,
    metadata: { headSha: revision.headSha },
  });
};
