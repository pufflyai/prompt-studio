import type { PlacementTabPresentation } from "@pstdio/sdk/extensions";
import { l10n, viewDataEvents } from "@pstdio/sdk/extensions";
import { newInViewer, switchConversation } from "./navigation";

export const conversationTab: PlacementTabPresentation = {
  refreshEvents: [viewDataEvents.sessionsChanged, viewDataEvents.workspacesChanged],
  async query(ctx, { renderer }) {
    const resource = renderer.resource;
    const saved = resource?.type === "session" ? await ctx.sessions.get(resource.id) : undefined;
    return {
      label: saved?.title ?? resource?.label ?? l10n("commands.new", "New session"),
      menu: [
        {
          id: "sessions",
          label: l10n("sessions.title", "Sessions"),
          rows: [
            {
              id: "new-session",
              label: l10n("commands.new", "New session"),
              icon: "message-circle",
              action: {
                kind: "command",
                target: {
                  command: newInViewer.ref,
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
