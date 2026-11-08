import type { WorkbenchModuleContribution } from "@pstdio/workbench";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { openDashboardTerminalSession } from "@/shared/terminal/api-terminal-session-opener";
import { createDashboardWorkspaceOptions } from "@/shared/workspaces/workspace-options";

/** Shared native PTY transport and compatibility for the former host command. */
export const createTerminalModule = () =>
  ({
    id: "dashboard.terminal",
    activate(ctx) {
      ctx.terminal.setSessionOpener((request, view) => {
        if (view) return openDashboardTerminalSession(request, view);
        if (request.cwd) return openDashboardTerminalSession(request);
        // Retained webview terminal.session clients may omit cwd. The desktop
        // host can run from `/`, so preserve their selected project root.
        const projectRoot = createDashboardWorkspaceOptions(getDashboardSelectedProjectId(ctx)).find(
          (workspace) => workspace.isDefault,
        )?.workspacePath;
        return openDashboardTerminalSession(projectRoot ? { ...request, cwd: projectRoot } : request);
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
