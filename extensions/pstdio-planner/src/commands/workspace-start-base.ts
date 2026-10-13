import type { CommandContext } from "@pstdio/sdk/extensions";
import { isLiveSession } from "./auto-build-sessions";
import { workspaceGitPath, workspaceHead } from "./change-requests";
export const readWorkspaceStartBase = async (ctx: CommandContext, workspaceId: string, base: string) => {
  const path = await workspaceGitPath(ctx, workspaceId);
  if ((await ctx.sessions.listByWorkspace(workspaceId)).some(isLiveSession))
    throw new Error("Another session is executing in the linked workspace. Wait for acknowledged handoff.");
  const actualBase = await workspaceHead(ctx, workspaceId);
  const ancestry = await ctx.process.run({
    command: ["git", "-C", path, "merge-base", "--is-ancestor", base, actualBase],
  });
  if (ancestry.exitCode !== 0)
    throw new Error(
      "The linked workspace does not contain the required base. Integrate it or explicitly request a new variant.",
    );
  return actualBase;
};
