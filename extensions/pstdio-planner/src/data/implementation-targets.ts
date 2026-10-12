import type { ExtensionContextBase } from "@pstdio/sdk/extensions";

export const targetBranchSetting = "implementation.defaultTargetBranch";
export const savedTargetBranch = (settings: Record<string, unknown>) => (settings[targetBranchSetting] ?? "") as string;

export const resolveImplementationBase = async (ctx: ExtensionContextBase, settings: Record<string, unknown>) => {
  const configured = savedTargetBranch(settings);
  if (configured) return configured;
  const workspace = await ctx.workspaces.getDefault();
  const cwd = workspace?.root_path;
  if (!cwd) throw new Error("Attach a Git project folder before using Auto build.");
  const remote = await ctx.process.run({
    command: ["git", "symbolic-ref", "--short", "refs/remotes/origin/HEAD"],
    cwd,
  });
  if (remote.exitCode === 0) return remote.stdout.trim();
  // Repositories without a remote commonly keep their default under one of these names.
  for (const branch of ["main", "master"]) {
    const local = await ctx.process.run({
      command: ["git", "show-ref", "--verify", "--quiet", `refs/heads/${branch}`],
      cwd,
    });
    if (local.exitCode === 0) return branch;
  }
  throw new Error(
    "Set Default target branch in Planner settings. The repository default branch is not available locally.",
  );
};

// One row per remote branch, so the setting's dropdown can load its choices
// from this command.
export const readImplementationTargets = async (ctx: ExtensionContextBase) => {
  const workspace = await ctx.workspaces.getDefault();
  if (!workspace?.root_path || workspace.execution_kind !== "local") return [];
  const cwd = workspace.root_path;
  const git = await ctx.process.run({ command: ["git", "rev-parse", "--is-inside-work-tree"], cwd });
  if (git.exitCode !== 0 || git.stdout.trim() !== "true") return [];
  const result = await ctx.process.runOrThrow({
    command: ["git", "for-each-ref", "--format=%(refname:strip=2)%09%(symref)", "refs/remotes/"],
    cwd,
  });
  return result.stdout
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split("\t"))
    .filter(([, symbolicRef]) => !symbolicRef)
    .map(([branch]) => ({ branch }));
};

export const setImplementationTarget = async (ctx: ExtensionContextBase, input: { branch?: string }) => {
  if (input.branch) {
    const targets = await readImplementationTargets(ctx);
    if (!targets.some((target) => target.branch === input.branch))
      throw new Error(`Unknown remote branch "${input.branch}"`);
    await ctx.settings.set(targetBranchSetting, input.branch);
  } else {
    await ctx.settings.delete(targetBranchSetting);
  }
  return { defaultTargetBranch: input.branch || null };
};
