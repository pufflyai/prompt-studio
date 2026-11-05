import type { PlacementTabPresentation } from "@pstdio/sdk/extensions";
import { l10n, viewDataEvents } from "@pstdio/sdk/extensions";
import { create, switchConversation } from "./navigation";

const icons: Record<string, string> = {
  in_progress: "loader-circle",
  completed: "circle-check",
  failed: "circle-alert",
  cancelled: "circle-stop",
  disconnected: "circle-pause",
  queued: "clock-alert",
  awaiting_input: "circle-dot",
};
const colors: Record<string, string> = {
  in_progress: "fg.info",
  queued: "fg.info",
  completed: "fg.success",
  failed: "fg.error",
  cancelled: "fg.warning",
  disconnected: "fg.warning",
  awaiting_input: "fg.warning",
};
export const conversationTab: PlacementTabPresentation = {
  refreshEvents: [viewDataEvents.sessionsChanged, viewDataEvents.workspacesChanged],
  async query(ctx, { renderer }) {
    const resource = renderer.resource;
    const saved = resource?.type === "session" ? await ctx.sessions.get(resource.id) : undefined;
    const workspaceId = saved?.workspaceId ?? resource?.metadata?.workspaceId;
    const status = saved?.status;
    return {
      label: saved?.title ?? resource?.label ?? l10n("commands.new", "New session"),
      icon: "message-circle",
      ...(status
        ? {
            indicator: {
              icon: icons[status] ?? "circle-dashed",
              color: colors[status] ?? "fg.muted",
              label: `Session status: ${status}`,
            },
          }
        : {}),
      menu: [
        {
          id: "sessions",
          label: l10n("sessions.title", "Sessions"),
          rows: [
            {
              id: "new-session",
              label: l10n("commands.new", "New session"),
              icon: "message-square-plus",
              action: {
                kind: "command",
                target: {
                  command: create.ref,
                  params: {
                    replace: true,
                    ...(typeof workspaceId === "string" ? { workspaceId } : {}),
                    ...(resource?.device?.id ? { deviceId: resource.device.id } : {}),
                  },
                },
              },
            },
            {
              id: "switch-session",
              label: l10n("commands.switch", "Switch session"),
              icon: "search",
              action: { kind: "command", target: { command: switchConversation.ref } },
            },
          ],
        },
      ],
    };
  },
};
