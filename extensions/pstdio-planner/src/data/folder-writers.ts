import type { CommandContext } from "@pstdio/sdk/extensions";
import { readAutoBuildSupervisor } from "./auto-build-supervisor";

export const hasFolderWriter = async (
  ctx: Pick<CommandContext, "storage" | "resources" | "sessions">,
  workspaceId: string,
  ownerSessionId?: string,
) => {
  // Planner's recorded supervisor only dispatches work; it is not an implementation
  // writer. All other live sessions in the shared folder retain writer exclusion.
  const supervisor = await readAutoBuildSupervisor(ctx);
  const excluded = new Set([ownerSessionId, supervisor.sessionId].filter((id) => id !== undefined));
  const page = await ctx.sessions.query({
    workspaceId,
    status: ["queued", "in_progress", "awaiting_input"],
    includeArchived: true,
    limit: excluded.size + 1,
  });
  return page.items.some(({ id }) => !excluded.has(id));
};
