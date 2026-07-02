import type { ArtifactMount, CommandContext, ExtensionWorkspace } from "@pstdio/sdk/extensions";
import { reportsCollection } from "./collections";
import { assertSafeReportName, assertSafeWorkspaceShorthand } from "./validation";

export const findReport = async (storage: CommandContext["storage"], workspaceShorthand: string, name: string) =>
  (await reportsCollection(storage).list()).find(
    (report) => report.workspaceShorthand === workspaceShorthand && report.name === name,
  ) ?? null;

const readWorkspaceIdFromConfig = async (repoFiles: ArtifactMount) => {
  if (!(await repoFiles.exists(".pstdio/config.json"))) return null;
  const raw = await repoFiles.readText(".pstdio/config.json");
  try {
    const parsed = JSON.parse(raw) as { workspace_id?: unknown };
    return typeof parsed.workspace_id === "string" && parsed.workspace_id ? parsed.workspace_id : null;
  } catch {
    return null;
  }
};

const pathBasename = (path: string) =>
  path
    .replace(/[/\\]+$/g, "")
    .split(/[/\\]/)
    .at(-1) ?? "";

const resolveWorkspaceFromRepoPath = async (ctx: CommandContext<Record<string, unknown>>) => {
  if (!ctx.repo?.path) return null;
  const workspaces = await ctx.workspaces.list();
  const workspace = workspaces.find((candidate) => candidate.worktree_path === ctx.repo?.path);
  if (workspace) return workspace;

  const shorthand = pathBasename(ctx.repo.path);
  return shorthand ? ctx.workspaces.getByShorthand(shorthand) : null;
};

export const resolveWorkspace = async (
  ctx: CommandContext<Record<string, unknown>>,
  repoFiles: ArtifactMount,
  workspaceOverride: string | undefined,
) => {
  let workspace: ExtensionWorkspace | null = null;
  let workspaceShorthand = workspaceOverride ?? null;

  if (workspaceOverride) {
    assertSafeWorkspaceShorthand(workspaceOverride);
    workspace = await ctx.workspaces.getByShorthand(workspaceOverride);
  } else {
    const workspaceId = (await readWorkspaceIdFromConfig(repoFiles)) ?? ctx.workspaceId ?? null;
    workspace = workspaceId ? await ctx.workspaces.get(workspaceId) : await resolveWorkspaceFromRepoPath(ctx);
    workspaceShorthand = workspace?.workspace_shorthand ?? null;
  }

  if (!workspaceShorthand)
    throw new Error("Unable to infer workspace shorthand. Pass --workspace <workspace_shorthand>.");
  assertSafeWorkspaceShorthand(workspaceShorthand);
  return { workspace, workspaceShorthand };
};

export const resolveReportName = (name: string | undefined, kind: string) => {
  const resolved =
    name ??
    kind
      .toLowerCase()
      .replaceAll(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  assertSafeReportName(resolved);
  return resolved;
};
