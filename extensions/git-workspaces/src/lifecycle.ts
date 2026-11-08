import { normalize } from "node:path";
import type {
  ExtensionContextBase,
  WorkspaceProviderCreateInput,
  WorkspaceProviderResolveInput,
} from "@pstdio/sdk/extensions";
import { resolveBase } from "./base";
import { git } from "./git";
import { localResult, ownedDirectory, registeredWorktrees } from "./worktree-ref";

export const prepareWorktree = async (ctx: ExtensionContextBase, input: WorkspaceProviderCreateInput) => {
  input.signal?.throwIfAborted();
  const home = await ctx.workspaces.getDefault();
  if (home?.executionKind !== "local" || !home.rootPath)
    throw new Error("A local project folder is required for a Git workspace.");
  const workspace = await ctx.workspaces.get(input.workspaceId);
  if (!workspace?.shorthand) throw new Error("The workspace has no allocated shorthand.");
  const sourceRoot = await git(ctx, ["rev-parse", "--show-toplevel"], home.rootPath);
  const relativePath = (await git(ctx, ["rev-parse", "--show-prefix"], home.rootPath)).replace(/\/$/, "");
  const base = await resolveBase(ctx, sourceRoot, typeof input.params.base === "string" ? input.params.base : "HEAD");
  if (relativePath) {
    const entry = await ctx.process.run({ command: ["git", "cat-file", "-t", `${base}:${relativePath}`], cwd: sourceRoot });
    if (entry.exitCode || entry.stdout.trim() !== "tree")
      throw new Error("The project folder is not a directory at the chosen revision.");
  }
  if (!ctx.localDirectory) throw new Error("This host cannot allocate provider directories.");
  const directory = await ctx.localDirectory();
  return localResult(
    {
      version: 1,
      data: {
        sourceRoot,
        worktreeRoot: directory.path,
        relativePath,
        base,
        branch: `workspace/${workspace.shorthand}-${input.workspaceId}`,
      },
    },
    "provisioning",
  );
};

export const resolveWorktree = async (ctx: ExtensionContextBase, input: WorkspaceProviderResolveInput) => {
  const paths = await ownedDirectory(ctx, input.providerRef);
  let entries = await registeredWorktrees(ctx, paths.sourceRoot);
  const workspace = await ctx.workspaces.get(input.workspaceId);
  const branch = typeof input.providerRef.data.branch === "string" ? input.providerRef.data.branch : workspace?.branch;
  const target = entries.find((entry) => entry.path === normalize(paths.worktreeRoot) && !entry.prunable);
  if (target) {
    return localResult(
      { ...input.providerRef, data: { ...input.providerRef.data, ...(branch ? { branch } : {}) } },
      "ready",
    );
  }
  const base = input.providerRef.data.base;
  if (workspace?.providerState !== "provisioning" || typeof base !== "string" || !branch)
    return {
      ...localResult(input.providerRef, "failed"),
      error: {
        code: "worktree_missing",
        message: "The Git worktree is missing. Restore its files before retrying.",
        retryable: true,
      },
    };
  if (entries.some((entry) => entry.branch === branch && !entry.prunable))
    throw new Error("The workspace branch is checked out outside its owned directory.");
  await git(ctx, ["worktree", "prune"], paths.sourceRoot);
  const exists = await ctx.process.run({
    command: ["git", "show-ref", "--verify", "--quiet", `refs/heads/${branch}`],
    cwd: paths.sourceRoot,
  });
  if (!exists.exitCode) await git(ctx, ["branch", "-D", branch], paths.sourceRoot);
  await git(ctx, ["worktree", "add", "-b", branch, paths.worktreeRoot, base], paths.sourceRoot);
  entries = await registeredWorktrees(ctx, paths.sourceRoot);
  if (!entries.some((entry) => entry.path === normalize(paths.worktreeRoot) && entry.branch === branch))
    throw new Error("Git did not register the owned workspace directory.");
  return localResult(input.providerRef, "ready");
};

export const deleteWorktree = async (ctx: ExtensionContextBase, input: WorkspaceProviderResolveInput) => {
  const paths = await ownedDirectory(ctx, input.providerRef);
  const probe = await ctx.process.run({
    command: ["git", "-C", paths.sourceRoot, "rev-parse", "--git-dir"],
    cwd: paths.directory.path,
    env: { LC_ALL: "C" },
  });
  if (probe.exitCode) {
    if (
      probe.stderr.startsWith("fatal: cannot change to ") &&
      probe.stderr.trim().endsWith(": No such file or directory")
    ) {
      await paths.directory.remove();
      return;
    }
    throw new Error(probe.stderr.trim() || "The source Git repository is unavailable.");
  }
  const entries = await registeredWorktrees(ctx, paths.sourceRoot);
  const target = entries.find((entry) => entry.path === normalize(paths.worktreeRoot));
  if (target && !target.prunable)
    await git(ctx, ["worktree", "remove", "--force", paths.worktreeRoot], paths.sourceRoot);
  else await git(ctx, ["worktree", "prune"], paths.sourceRoot);
  const workspace = await ctx.workspaces.get(input.workspaceId);
  const ownedBranch = workspace?.shorthand ? `workspace/${workspace.shorthand}-${input.workspaceId}` : undefined;
  if (ownedBranch) await ctx.process.run({ command: ["git", "branch", "-D", ownedBranch], cwd: paths.sourceRoot });
  await paths.directory.remove();
};
