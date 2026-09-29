import type { WorkbenchModuleContribution } from "@pstdio/workbench";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { openDashboardTerminalSession } from "@/shared/terminal/api-terminal-session-opener";
import { createDashboardWorkspaceOptions } from "@/shared/workspaces/workspace-options";

/** Backs workbench terminal sessions with the API PTY transport. */
export const createTerminalModule = () =>
  ({
    id: "dashboard.terminal",
    activate(ctx) {
      ctx.terminal.setSessionOpener((request) => {
        if (request.cwd) return openDashboardTerminalSession(request);
        // The host process may run from any folder (`/` for the desktop app), so a
        // terminal that names no workspace starts in the project's root checkout.
        const projectRoot = createDashboardWorkspaceOptions(getDashboardSelectedProjectId(ctx)).find(
          (workspace) => workspace.isDefault,
        )?.workspacePath;
        return openDashboardTerminalSession(projectRoot ? { ...request, cwd: projectRoot } : request);
      });
      return [{ dispose: () => ctx.terminal.setSessionOpener(null) }];
    },
  }) satisfies WorkbenchModuleContribution;
