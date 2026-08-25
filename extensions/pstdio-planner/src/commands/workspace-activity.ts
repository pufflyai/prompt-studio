import { defineCommand, params, type ResourceAnchor } from "@pstdio/sdk/extensions";
import { isLiveSessionStatus } from "../session-status";

const phaseFromAnchors = (anchors: ResourceAnchor[]) => {
  if (anchors.some((anchor) => anchor.type === "planner-review")) return "review" as const;
  const phase = anchors.find((anchor) => anchor.type === "planner-attempt")?.metadata?.phase;
  if (phase === "implementation" || phase === "review") return phase;
  return "other" as const;
};

// Live workspace state derived from anchored sessions; replaces the stored
// workspace-status model. `disconnected` counts as inactive but stays visible in
// the session list so stuck-work logic can make an explicit decision.
export const workspaceActivityCommand = defineCommand({
  title: "Workspace activity",
  params: {
    workspaceId: params.text({ label: "Workspace", required: true }),
  },
  async run(ctx, commandParams) {
    const sessions = (await ctx.sessions.listByWorkspace(commandParams.workspaceId)).map((session) => {
      const anchors = (session.anchors_json ?? []) as ResourceAnchor[];
      return {
        id: session.id,
        title: session.title,
        status: session.status as string,
        anchors,
        phase: phaseFromAnchors(anchors),
        ...(session.created_at ? { createdAt: session.created_at } : {}),
        ...(session.updated_at ? { updatedAt: session.updated_at } : {}),
      };
    });

    return {
      active: sessions.some((session) => isLiveSessionStatus(session.status)),
      sessions,
    };
  },
});
