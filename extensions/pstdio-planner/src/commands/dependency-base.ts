import type { CommandContext } from "@pstdio/sdk/extensions";
import type { AttemptReadinessResult } from "../data/attempt-readiness";
import { readAttempt } from "../data/attempt-storage";

type Ready = Extract<AttemptReadinessResult, { decision: "ready" }>;

export const dependencyHeads = async (ctx: Pick<CommandContext, "storage" | "resources">, workspaceIds: string[]) =>
  Promise.all(
    workspaceIds.map(async (id) => {
      const attempt = await readAttempt(ctx.storage, id);
      const head = attempt?.revisions.at(-1)?.headSha;
      if (!head) throw new Error(`Dependency workspace ${id} has no submitted revision.`);
      return head;
    }),
  );

export const containsDependencyHeads = async (ctx: CommandContext, readiness: Ready, head: string) => {
  const workspace = await ctx.workspaces.getDefault();
  if (!workspace?.root_path) throw new Error("The project has no Git folder.");
  for (const dependency of await dependencyHeads(ctx, readiness.dependencyAttemptIds)) {
    const result = await ctx.process.run({
      command: ["git", "-C", workspace.root_path, "merge-base", "--is-ancestor", dependency, head],
    });
    if (result.exitCode === 1) return false;
    if (result.exitCode !== 0) throw new Error(result.stderr);
  }
  return true;
};

// A combined dependency commit belongs to the attempt base. No target branch or worktree is changed.
export const prepareDependencyBase = async (ctx: CommandContext, readiness: Ready) => {
  const base = { workspaceId: readiness.baseWorkspaceId, headSha: readiness.baseHeadSha };
  if (readiness.mode !== "stacked" || readiness.baseWorkspaceId) return base;
  const workspace = await ctx.workspaces.getDefault();
  if (!workspace?.root_path) throw new Error("The project has no Git folder.");
  let head = base.headSha;
  for (const dependency of await dependencyHeads(ctx, readiness.dependencyAttemptIds)) {
    const tree = await ctx.process.run({
      command: ["git", "-C", workspace.root_path, "merge-tree", "--write-tree", head, dependency],
    });
    // Conflicts belong to the implementation owner. Keep a clean starting base so it can reconcile them there.
    if (tree.exitCode === 1) return base;
    if (tree.exitCode !== 0) throw new Error(tree.stderr.trim() || "Could not combine dependency revisions.");
    const commit = await ctx.process.run({
      command: [
        "git",
        "-C",
        workspace.root_path,
        "-c",
        "user.name=Planner",
        "-c",
        "user.email=planner@example.invalid",
        "commit-tree",
        tree.stdout.trim().split("\n")[0]!,
        "-p",
        head,
        "-p",
        dependency,
        "-m",
        "Combine submitted dependency revisions",
      ],
    });
    if (commit.exitCode !== 0) throw new Error(commit.stderr);
    head = commit.stdout.trim();
  }
  return { workspaceId: null, headSha: head };
};
