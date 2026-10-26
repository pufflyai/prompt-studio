import type { WorkbenchModuleContext } from "@pstdio/workbench";
import { dashboardCommandIds } from "@/shared/app/commands";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { resolveSessionTabWorkspace } from "./session-tab-presentation";

export const registerSessionKeyboard = (ctx: WorkbenchModuleContext) => {
  const id = "dashboard.newSessionInTab";
  ctx.commands.registerCommand(
    { id, label: "New session in this tab" },
    {
      isVisible: (_args, context) =>
        Boolean(context?.resource && ["session", "session-draft"].includes(context.resource.type)),
      execute: async (_args, context) => {
        const instance = ctx.layout.getActivePanel(context?.region);
        if (
          !instance?.placementIdentity ||
          ![dashboardWidgetIds.session, dashboardWidgetIds.sessionBubble].some((id) => id === instance.viewId)
        )
          return;
        if (instance.resource?.id !== context?.resource?.id) return;
        await ctx.commands.executeCommand(
          dashboardCommandIds.createSession,
          { workspace: resolveSessionTabWorkspace(ctx, instance), replacePanel: instance.placementIdentity },
          context,
        );
      },
    },
  );
  ctx.keybindings.registerKeybinding({
    action: { kind: "command", commandId: id },
    keybinding: "N",
    layer: "current",
    targetScope: "panel",
  });
};
