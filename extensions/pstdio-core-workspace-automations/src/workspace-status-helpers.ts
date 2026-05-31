const WORKSPACE_BRANCH_PREFIX = "workspace/";

export const detectWorkspaceFromBranch = async (ctx: {
  repo?: { path: string };
  process: { run(input: { command: string[]; cwd?: string }): Promise<{ exitCode: number; stdout: string }> };
}) => {
  if (!ctx.repo?.path) return undefined;

  const result = await ctx.process.run({
    command: ["git", "symbolic-ref", "--short", "HEAD"],
    cwd: ctx.repo.path,
  });
  if (result.exitCode !== 0) return undefined;

  const branch = result.stdout.trim();
  if (!branch.startsWith(WORKSPACE_BRANCH_PREFIX)) return undefined;
  return branch.slice(WORKSPACE_BRANCH_PREFIX.length).trim() || undefined;
};

export const workspaceIdForStatusFrom = async (ctx: {
  params: { workspace?: string; workspaceId?: string };
  repo?: { path: string };
  process: { run(input: { command: string[]; cwd?: string }): Promise<{ exitCode: number; stdout: string }> };
  workspaces: { getByShorthand(shorthand: string): Promise<{ id: string } | null> };
}) => {
  const workspaceId = ctx.params.workspaceId?.trim();
  if (workspaceId) return workspaceId;

  const shorthand = ctx.params.workspace?.trim() ?? (await detectWorkspaceFromBranch(ctx));
  if (!shorthand) throw new Error("Workspace is required.");

  const workspace = await ctx.workspaces.getByShorthand(shorthand);
  if (!workspace) throw new Error(`Workspace not found: ${shorthand}`);
  return workspace.id;
};
