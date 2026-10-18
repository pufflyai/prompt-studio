import type { ResourceRef, WorkbenchModuleContext } from "@pstdio/workbench";
import { WORKBENCH_TERMINAL_WIDGET_ID } from "@pstdio/workbench/react";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import {
  createDashboardWorkspaceOptionResource,
  createDashboardWorkspaceOptions,
} from "@/shared/workspaces/workspace-options";

export const workspaceTerminalResources = (ctx: WorkbenchModuleContext, source: ResourceRef) => {
  if (source.extensionId !== "pstdio" || source.type !== "workspace") return [];
  if (!ctx.shellPlacements.getPlacement(WORKBENCH_TERMINAL_WIDGET_ID)) return [];
  const projectId = getDashboardSelectedProjectId(ctx);
  if (source.projectId !== projectId) return [];
  const option = createDashboardWorkspaceOptions(projectId).find((workspace) => workspace.id === source.id);
  const workspace: ResourceRef = option ? createDashboardWorkspaceOptionResource(option, projectId) : source;
  if (
    workspace.metadata?.workspaceExecutionKind !== "local" ||
    workspace.metadata.workspaceProviderState !== "ready" ||
    !workspace.metadata.workspacePath
  )
    return [];
  const terminals = ctx.layout
    .listPanelInstances()
    .filter(
      (panel) => panel.viewId === WORKBENCH_TERMINAL_WIDGET_ID && panel.resource?.metadata?.workspaceId === source.id,
    );
  const active = ctx.layout.getActivePanel("secondary");
  const last = terminals.find((panel) => panel.instanceId === active?.instanceId) ?? terminals.at(-1);
  const resource: ResourceRef = last?.resource ?? {
    type: "terminal",
    id: `workspace:${source.id}`,
    extensionId: "pstdio",
    projectId,
    label: "Terminal",
    icon: "SquareTerminal",
    metadata: workspace.metadata,
  };
  return [
    {
      resource,
      target: {
        kind: "panel" as const,
        panel: { kind: "shell-placement" as const, id: WORKBENCH_TERMINAL_WIDGET_ID },
        resource,
      },
    },
  ];
};
