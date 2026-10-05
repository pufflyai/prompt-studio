import type { WorkbenchModuleContext } from "@pstdio/workbench";
import { getApiClient } from "@/lib/api";
import { dashboardCommandIds } from "@/shared/app/commands";

export const registerSessionRenameCommand = (ctx: WorkbenchModuleContext) =>
  ctx.commands.registerCommand(
    {
      id: dashboardCommandIds.renameSession,
      label: "Rename session",
      category: "Dashboard",
      icon: "Pencil",
      params: { title: { type: "text", label: "Session name", required: true } },
    },
    {
      isVisible: (args) =>
        Boolean((args as { sessionId?: string } | undefined)?.sessionId || ctx.getActiveResource()?.type === "session"),
      prepareArgs: (args) => {
        const resource = ctx.getActiveResource();
        const values = (args ?? {}) as { sessionId?: string; title?: string };
        return { sessionId: resource?.id, title: resource?.label, ...values };
      },
      execute: async (args) => {
        const { sessionId, title } = args as { sessionId: string; title: string };
        return getApiClient().sessions.rename(sessionId, title.trim());
      },
    },
  );
