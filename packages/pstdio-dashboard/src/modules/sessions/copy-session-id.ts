import {
  resourceContextMenuPath,
  type WorkbenchCommandExecutionContext,
  type WorkbenchModuleContext,
  workbenchResourceTypeContextKey,
} from "@pstdio/workbench";
import { dashboardCommandIds } from "@/shared/app/commands";

interface CopySessionArgs {
  sessionId?: string;
}

export const registerCopySessionId = (ctx: WorkbenchModuleContext) => {
  const resolveId = (args: CopySessionArgs | undefined, context?: WorkbenchCommandExecutionContext) => {
    const resource = context?.resource ?? ctx.getActiveResource();
    const id = args?.sessionId ?? (resource?.type === "session" ? resource.id : undefined);
    if (!id) throw new Error("Choose a saved session first.");
    return id;
  };
  const when = `${workbenchResourceTypeContextKey} == "session"`;
  ctx.commands.registerCommand(
    { id: dashboardCommandIds.copySessionId, label: "Copy session ID", category: "Session", icon: "copy", when },
    {
      prepareArgs: (args: CopySessionArgs | undefined, context) => ({ sessionId: resolveId(args, context) }),
      execute: async (args: CopySessionArgs | undefined, context) => {
        await navigator.clipboard.writeText(resolveId(args, context));
        ctx.notifications.show({ level: "success", title: "Session ID copied" });
      },
    },
  );
  ctx.layout.registerMenuItem(resourceContextMenuPath("session"), {
    commandId: dashboardCommandIds.copySessionId,
    group: "kernel",
    order: 10,
    when,
  });
};
