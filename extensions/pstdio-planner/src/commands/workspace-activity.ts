import { defineCommand, params } from "@pstdio/sdk/extensions";
import { isLiveSessionStatus } from "../session-status";

// Live workspace state derived from anchored sessions; replaces the stored
// workspace-status model. `disconnected` counts as inactive but stays visible in
// the session list so stuck-work logic can make an explicit decision.
export const workspaceActivityCommand = defineCommand({
  title: "Workspace activity",
  params: {
    workspaceId: params.text({ label: "Workspace", required: true }),
  },
  async run(ctx) {
    const sessions = (await ctx.sessions.listByWorkspace(ctx.params.workspaceId)).map((session) => ({
      id: session.id,
      title: session.title,
      status: session.status as string,
      ...(session.created_at ? { createdAt: session.created_at } : {}),
      ...(session.updated_at ? { updatedAt: session.updated_at } : {}),
    }));

    return {
      active: sessions.some((session) => isLiveSessionStatus(session.status)),
      sessions,
    };
  },
});
