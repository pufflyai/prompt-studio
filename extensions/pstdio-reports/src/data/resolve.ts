import type { CommandContext, ExtensionWorkspace } from "@pstdio/sdk/extensions";
import { reportsCollection } from "./collections";
import { assertSafeReportName, assertSafeWorkspaceShorthand } from "./validation";

export const findReport = async (storage: CommandContext["storage"], workspaceShorthand: string, name: string) =>
  (await reportsCollection(storage).list()).find(
    (report) => report.workspaceShorthand === workspaceShorthand && report.name === name,
  ) ?? null;

export const resolveWorkspace = async (
  ctx: CommandContext<Record<string, unknown>>,
  workspaceOverride: string | undefined,
) => {
  let workspace: ExtensionWorkspace | null = null;
  let workspaceShorthand = workspaceOverride ?? null;

  if (workspaceOverride) {
    assertSafeWorkspaceShorthand(workspaceOverride);
    workspace = await ctx.workspaces.getByShorthand(workspaceOverride);
  } else {
    const workspaceId = ctx.workspaceId ?? null;
    workspace = workspaceId ? await ctx.workspaces.get(workspaceId) : await ctx.workspaces.getDefault();
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
