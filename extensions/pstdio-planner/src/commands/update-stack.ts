import type { ParamsOf } from "@pstdio/sdk/extensions";
import { type CommandContext, defineCommand, params } from "@pstdio/sdk/extensions";
import { actorFromSource } from "../data/attempt-actors";
import { appendAttemptEvent, attemptEventsCollection, putAttempt, readAttempt } from "../data/attempt-storage";
import type { AttemptRecord } from "../data/attempt-types";
import { readSessionHistory } from "../data/session-history";
import { withWriteGuard } from "../data/write-guard";
import { loadAttemptDependencies } from "./attempt-readiness";
import { isLiveSession } from "./auto-build-sessions";
import { WorkspaceUnavailableError, workspaceGitPath, workspaceHead } from "./change-requests";
import { containsDependencyHeads, dependencyHeads } from "./dependency-base";
import { containsCommit, prepareRequiredStackBase, readRequiredStackDependencies } from "./stack-validation";

export async function readStackRepair(ctx: CommandContext, attempt: AttemptRecord) {
  const latest = attempt.revisions.at(-1);
  const session = await ctx.sessions.get(attempt.implementationSessionId);
  if (isLiveSession(session)) return null;
  const workspace = await ctx.workspaces.get(attempt.workspaceId);
  if (!workspace?.root_path || workspace.id !== attempt.workspaceId)
    throw new WorkspaceUnavailableError(`Workspace ${attempt.workspaceShorthand} is no longer available.`);
  const head = await workspaceHead(ctx, attempt.workspaceId);
  if (!session) return null;
  if (
    !(await readSessionHistory(ctx.sessions, { workspaceId: attempt.workspaceId })).some(({ id }) => id === session.id)
  )
    return null;
  const eventId = `stack-repair-resumed:${session.id}:${session.updated_at ?? attempt.updatedAt}`;
  if (await attemptEventsCollection(ctx.storage).get(eventId)) return null;
  const { readiness } = await loadAttemptDependencies(ctx, attempt.ticketId, {
    base: attempt.base.headSha,
    dependencyReview: "submitted",
  });
  if (readiness.decision === "wait") return null;
  const base =
    readiness.mode === "main"
      ? attempt.base
      : { workspaceId: readiness.baseWorkspaceId, headSha: readiness.baseHeadSha };
  const needsIntegration =
    !(await containsCommit(ctx, workspace.root_path, base.headSha, head)) ||
    !(await containsDependencyHeads(ctx, readiness, head));
  if ((!latest || (head === latest.headSha && latest.baseSha === base.headSha)) && !needsIntegration) return null;
  return {
    eventId,
    workspaceId: attempt.workspaceId,
    sessionId: attempt.implementationSessionId,
    headSha: head,
    base,
    needsIntegration,
  };
}

const stackUpdateParams = {
  workspaceId: params.text({ required: true }),
  implementationSessionId: params.text({ required: true }),
  expectedHeadSha: params.text({ required: true }),
  base: params.text({ label: "Root target branch" }),
};

async function updateStack(ctx: CommandContext, input: ParamsOf<typeof stackUpdateParams>) {
  const attempt = await readAttempt(ctx.storage, input.workspaceId);
  if (!attempt || attempt.implementationSessionId !== input.implementationSessionId)
    throw new Error("The implementation session does not own this workspace.");
  const owner = await ctx.sessions.get(input.implementationSessionId);
  const sessions = await readSessionHistory(ctx.sessions, { workspaceId: attempt.workspaceId });
  if (!owner || !sessions.some(({ id }) => id === owner.id))
    throw new Error("The implementation session is not linked to this workspace.");
  if (sessions.some((session) => session.id !== owner.id && isLiveSession(session)))
    throw new Error("Another session is using this workspace. Wait for its handoff before updating the stack.");
  const path = await workspaceGitPath(ctx, attempt.workspaceId);
  const before = await workspaceHead(ctx, attempt.workspaceId);
  if (before !== input.expectedHeadSha) throw new Error("Workspace HEAD changed before updating the stack.");
  const status = await ctx.process.run({ command: ["git", "-C", path, "status", "--porcelain"] });
  if (status.exitCode !== 0) throw new Error(status.stderr);
  if (status.stdout.trim()) throw new Error("Commit or resolve the workspace changes before updating the stack.");
  const readiness = await readRequiredStackDependencies(ctx, attempt, input.base);
  const base = await prepareRequiredStackBase(ctx, attempt, input.base);
  for (const required of [base.headSha, ...(await dependencyHeads(ctx, readiness.dependencyAttemptIds))]) {
    if (await containsCommit(ctx, path, required, await workspaceHead(ctx, attempt.workspaceId))) continue;
    const merged = await ctx.process.run({
      command: ["git", "-C", path, "merge", "--no-edit", "--", required],
    });
    if (merged.exitCode !== 0)
      throw new Error(
        `Dependency integration needs repair in this workspace. Reconcile the code, resolve and commit the merge, then retry update-stack. Do not request human review for Git conflicts; ask only for conflicting requirements or design decisions. ${merged.stdout.trim()} ${merged.stderr.trim()}`,
      );
  }
  const headSha = await workspaceHead(ctx, attempt.workspaceId);
  const current = await readRequiredStackDependencies(ctx, attempt, input.base);
  if (JSON.stringify(current) !== JSON.stringify(readiness) || !(await containsDependencyHeads(ctx, current, headSha)))
    throw new Error("The selected dependency revision changed during integration. Query and update the stack again.");
  if (!(await containsCommit(ctx, path, base.headSha, headSha)))
    throw new Error("The updated workspace does not contain the required dependency base.");
  if (attempt.base.headSha !== base.headSha || attempt.base.workspaceId !== base.workspaceId) {
    await putAttempt(ctx.storage, { ...attempt, base, updatedAt: new Date().toISOString() });
    await appendAttemptEvent(ctx.storage, {
      workspaceId: attempt.workspaceId,
      type: "stack_updated",
      revision: null,
      actor: actorFromSource(ctx.source, ctx.invocationId),
      sessionId: owner.id,
      commitSha: headSha,
      reportId: null,
      reviewId: null,
      threadId: null,
      metadata: { previousBaseSha: attempt.base.headSha, baseSha: base.headSha, baseWorkspaceId: base.workspaceId },
    });
  }
  return { workspaceId: attempt.workspaceId, headSha, base, validationRequired: true };
}

export const updateStackCommand = defineCommand({
  id: "update-stack",
  title: "Update dependency stack",
  cli: true,
  mutating: true,
  params: stackUpdateParams,
  async run(ctx, input) {
    return withWriteGuard(ctx, `attempt:${input.workspaceId}`, () => updateStack(ctx, input));
  },
});
