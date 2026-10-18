import type { WorkbenchModuleContribution } from "@pstdio/workbench";
import { WORKBENCH_TERMINAL_WIDGET_ID } from "@pstdio/workbench/react";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { openDashboardTerminalSession } from "@/shared/terminal/api-terminal-session-opener";
import { workspaceTerminalResources } from "@/shared/terminal/workspace-terminal-resources";
import { createDashboardWorkspaceOptions } from "@/shared/workspaces/workspace-options";

/** Backs workbench terminal sessions with the API PTY transport. */
export const createTerminalModule = () =>
  ({
    id: "dashboard.terminal",
    activate(ctx) {
      ctx.resources.registerKind({ kind: "terminal", label: "Terminal", icon: "SquareTerminal" });
      ctx.resources.registerProvider({
        id: "dashboard.terminals",
        kind: "terminal",
        list: () => {
          const projectId = getDashboardSelectedProjectId(ctx);
          const existing = ctx.layout.listPanelInstances().flatMap((panel) =>
            panel.viewId === WORKBENCH_TERMINAL_WIDGET_ID &&
            panel.resource?.type === "terminal" &&
            panel.resource.extensionId === "pstdio"
              ? [
                  {
                    resource: panel.resource,
                    target: {
                      kind: "panel" as const,
                      panel: { kind: "shell-placement" as const, id: WORKBENCH_TERMINAL_WIDGET_ID },
                      resource: panel.resource,
                    },
                  },
                ]
              : [],
          );
          const available = createDashboardWorkspaceOptions(projectId).flatMap((workspace) =>
            workspaceTerminalResources(ctx, { type: "workspace", id: workspace.id, projectId, extensionId: "pstdio" }),
          );
          return [...existing, ...available];
        },
      });
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
