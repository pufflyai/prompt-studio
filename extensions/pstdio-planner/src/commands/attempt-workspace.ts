import type { CommandContext } from "@pstdio/sdk/extensions";
import { readAttempt } from "../data/attempt-storage";
import { readSessionHistory } from "../data/session-history";
import { isLiveSession } from "./auto-build-sessions";
import { workspaceHead } from "./change-requests";
import { requireReadyWorkspace, resolveTicketAnchor } from "./ticket-actions";

// Adoption leaves the Git branch, commits, index, and working files untouched.
export async function adoptDraftWorkspace(
  ctx: CommandContext,
  ticketRef: string,
  workspaceId: string,
  beforeDispatch: () => Promise<void>,
) {
  const { anchor, ticket } = await resolveTicketAnchor(ctx, ticketRef);
  const read = async () => {
    const workspace = await ctx.workspaces.get(workspaceId);
    if (!workspace || workspace.project_id !== ctx.projectId)
      throw new Error("The existing workspace must belong to this project.");
    if (!workspace.anchors_json?.some((item) => item.type === "ticket" && item.id === ticket.id))
      throw new Error("The existing workspace must be linked to this ticket.");
    if (workspace.provider_id !== "pstdio.worktree") throw new Error("A Git worktree is required.");
    await requireReadyWorkspace(ctx, workspace);
    if (await readAttempt(ctx.storage, workspaceId))
      throw new Error("This workspace already has a managed attempt. Resume its existing owner.");
    if ((await readSessionHistory(ctx.sessions, { workspaceId })).some(isLiveSession))
      throw new Error("Another session is using this workspace. Wait for its handoff.");
    return workspace;
  };
  await read();
  const headSha = await workspaceHead(ctx, workspaceId);
  await beforeDispatch();
  const workspace = await read();
  if ((await workspaceHead(ctx, workspaceId)) !== headSha)
    throw new Error("Workspace HEAD changed before dispatch. Query and dispatch again.");
  return { anchor, ticket, workspace, mode: "worktree", headSha };
}
