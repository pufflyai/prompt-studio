import type { WorkbenchModuleContribution } from "@pstdio/workbench";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { openDashboardTerminalSession } from "@/shared/terminal/api-terminal-session-opener";
import { createDashboardWorkspaceOptions } from "@/shared/workspaces/workspace-options";

/** Shared native PTY transport and compatibility for the former host command. */
export const createTerminalModule = () =>
  ({
    id: "dashboard.terminal",
    activate(ctx) {
      ctx.terminal.setSessionOpener((request, view, signal, binding, placement) => {
        const projectId = getDashboardSelectedProjectId(ctx);
        // A placement's terminal keeps running when its workbench closes, so reopening the
        // project, its desktop tab, or the page resumes the same shell.
        const attachment = view ? placement : binding;
        const attachKey = attachment && projectId ? `${projectId}/${attachment}` : undefined;
        if (view) return openDashboardTerminalSession(request, view, signal, attachKey);
        if (request.cwd) return openDashboardTerminalSession(request, undefined, signal, attachKey);
        // The host process may run from any folder (`/` for the desktop app), so a
        // terminal that names no workspace starts in the project's root checkout.
        const projectRoot = createDashboardWorkspaceOptions(projectId).find(
          (workspace) => workspace.isDefault,
        )?.workspacePath;
        return openDashboardTerminalSession(
          projectRoot ? { ...request, cwd: projectRoot } : request,
          undefined,
          signal,
          attachKey,
        );
      });
      const legacy = ctx.commands.registerCommand(
        { id: "workbench.terminal.open", label: "Open terminal" },
        {
          isVisible: () => false,
          execute: (args, invocation) =>
            ctx.commands.executeCommand("pstdio.pstdio-terminal.command.open", args, {
              ...invocation,
              resource: invocation?.resource ?? ctx.getActiveResource() ?? ctx.getPrimaryResource(),
            }),
        },
      );
      return [legacy, { dispose: () => ctx.terminal.setSessionOpener(null) }];
    },
  }) satisfies WorkbenchModuleContribution;
