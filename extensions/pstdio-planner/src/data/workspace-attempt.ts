import type { CommandContext } from "@pstdio/sdk/extensions";
import { listAttempts, readAttempt } from "./attempt-storage";

type Context = Pick<CommandContext, "storage" | "workspaces">;

// The core workspace owns its public reference. Refresh the Planner's display copy on reads.
export const readWorkspaceAttempt = async (ctx: Context, reference: string) => {
  const workspace = await ctx.workspaces.get(reference);
  if (!workspace) return readAttempt(ctx.storage, reference);
  const attempt = await readAttempt(ctx.storage, workspace.id);
  if (!attempt || !workspace.workspace_shorthand || attempt.workspaceShorthand === workspace.workspace_shorthand)
    return attempt;
  return { ...attempt, workspaceShorthand: workspace.workspace_shorthand };
};

export const listWorkspaceAttempts = async (ctx: Context) => {
  const attempts = await listAttempts(ctx.storage);
  return Promise.all(
    attempts.map(async (attempt) => (await readWorkspaceAttempt(ctx, attempt.workspaceId)) ?? attempt),
  );
};
