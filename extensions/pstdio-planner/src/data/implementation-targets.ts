import type { ExtensionContextBase } from "@pstdio/sdk/extensions";

export const targetBranchSetting = "implementation.defaultTargetBranch";
export const savedTargetBranch = (settings: Record<string, unknown>) => (settings[targetBranchSetting] ?? "") as string;

export const readImplementationTargets = async (ctx: ExtensionContextBase) => {
  const workspace = await ctx.workspaces.getDefault();
  if (!workspace?.root_path || workspace.execution_kind !== "local") return null;
  const cwd = workspace.root_path;
  const git = await ctx.process.run({ command: ["git", "rev-parse", "--is-inside-work-tree"], cwd });
  if (git.exitCode !== 0 || git.stdout.trim() !== "true") return null;
  const result = await ctx.process.runOrThrow({
    command: ["git", "for-each-ref", "--format=%(refname:strip=2)%09%(symref)", "refs/remotes/"],
    cwd,
  });
  const branches = result.stdout
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split("\t"))
    .filter(([, symbolicRef]) => !symbolicRef)
    .map(([name]) => name);
  return { branches, selected: savedTargetBranch(await ctx.settings.all()) };
};

export const setImplementationTarget = async (ctx: ExtensionContextBase, input: { branch?: string }) => {
  if (input.branch) {
    const target = await readImplementationTargets(ctx);
    if (!target?.branches.includes(input.branch)) throw new Error(`Unknown remote branch "${input.branch}"`);
    await ctx.settings.set(targetBranchSetting, input.branch);
  } else {
    await ctx.settings.delete(targetBranchSetting);
  }
  return { defaultTargetBranch: input.branch || null };
};
