import type { CommandContext } from "@pstdio/sdk/extensions";
import type { AttemptRecord } from "../data/attempt-types";
import { loadAttemptDependencies } from "./attempt-readiness";
import { containsDependencyHeads, prepareDependencyBase } from "./dependency-base";

export async function containsCommit(ctx: Pick<CommandContext, "process">, path: string, base: string, head: string) {
  const result = await ctx.process.run({ command: ["git", "-C", path, "merge-base", "--is-ancestor", base, head] });
  if (result.exitCode === 0) return true;
  if (result.exitCode === 1) return false;
  throw new Error(result.stderr.trim() || "Could not compare stack commits.");
}

export async function readRequiredStackDependencies(ctx: CommandContext, attempt: AttemptRecord, baseRef?: string) {
  const { readiness } = await loadAttemptDependencies(ctx, attempt.ticketId, {
    base: baseRef ?? attempt.base.headSha,
  });
  if (readiness.decision === "wait") {
    throw new Error(
      `Cannot update dependencies for ${attempt.ticketShorthand}: ${readiness.reason} (${readiness.dependencyIds.join(", ")}).`,
    );
  }
  return readiness;
}

export async function readRequiredStackBase(ctx: CommandContext, attempt: AttemptRecord, head: string) {
  const readiness = await readRequiredStackDependencies(ctx, attempt);
  if (readiness.mode === "main") return attempt.base;
  if (!readiness.baseWorkspaceId) {
    if (!(await containsDependencyHeads(ctx, readiness, head)))
      throw new Error(
        `Workspace HEAD has outdated dependencies. Run pst pstdio-planner update-stack --workspace-id ${attempt.workspaceId} --implementation-session-id ${attempt.implementationSessionId} --expected-head-sha ${head}, validate, then submit again.`,
      );
    return attempt.base;
  }
  return { workspaceId: readiness.baseWorkspaceId, headSha: readiness.baseHeadSha };
}

export async function prepareRequiredStackBase(ctx: CommandContext, attempt: AttemptRecord, baseRef?: string) {
  const readiness = await readRequiredStackDependencies(ctx, attempt, baseRef);
  if (readiness.mode === "main") return baseRef ? { workspaceId: null, headSha: readiness.baseHeadSha } : attempt.base;
  return prepareDependencyBase(ctx, readiness);
}

export async function validateSubmittedStack(ctx: CommandContext, attempt: AttemptRecord, path: string, head: string) {
  if (!(await containsCommit(ctx, path, attempt.base.headSha, head))) {
    throw new Error(
      "Workspace HEAD does not contain its recorded base. Restore the ticket changes on that base before submitting.",
    );
  }
  const base = await readRequiredStackBase(ctx, attempt, head);
  if (!(await containsCommit(ctx, path, base.headSha, head))) {
    throw new Error(
      `Workspace HEAD has outdated dependencies. Run pst pstdio-planner update-stack --workspace-id ${attempt.workspaceId} --implementation-session-id ${attempt.implementationSessionId} --expected-head-sha ${head}, validate the result, then submit again. Required base: ${base.headSha}.`,
    );
  }
  return base;
}
