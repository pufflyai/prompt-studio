import { type WorkbenchModuleContribution, workbenchCommandPaletteMenuPath } from "pstdio-workbench/core";
import { dashboardCommandIds, dashboardWidgetIds } from "@/services/workbench/ids";
import { openSurfaceWidget } from "@/services/workbench/module-helpers";
import { dashboardResourceKindIds, dashboardViewResource } from "@/services/workbench/resources/resource-kinds";
import { WorkspaceDetail } from "./renderers/workspace-detail";
import { WorkspacesOverview } from "./renderers/workspaces-overview";

// Workspaces surface: an overview list plus per-workspace detail tabs backed by
// the live `workspaces` collection.
export const createWorkspacesModule = (projectId: string): WorkbenchModuleContribution => ({
  id: "pstdio-dashboard-workbench.workspaces",
  activate(ctx) {
    ctx.resources.registerKind({ kind: dashboardResourceKindIds.workspace, label: "Workspace", icon: "GitBranch" });

    ctx.renderers.registerRenderer({
      id: dashboardWidgetIds.workspacesOverview,
      render: (input) => <WorkspacesOverview input={input} projectId={projectId} />,
    });
    ctx.renderers.registerRenderer({
      id: dashboardWidgetIds.workspaceDetail,
      render: (input) => <WorkspaceDetail input={input} projectId={projectId} />,
    });

    ctx.layout.registerWidget({
      id: dashboardWidgetIds.workspacesOverview,
      title: "Workspaces",
      area: "main",
      singleton: true,
      rendererId: dashboardWidgetIds.workspacesOverview,
    });
    ctx.layout.registerWidget({
      id: dashboardWidgetIds.workspaceDetail,
      title: "Workspace",
      area: "main",
      closable: true,
      rendererId: dashboardWidgetIds.workspaceDetail,
      resourceKinds: [dashboardResourceKindIds.workspace],
    });

    ctx.resources.registerOpener({
      id: "pstdio-dashboard-workbench.workspaces.opener",
      canOpen: (resource) =>
        resource.kind === dashboardResourceKindIds.workspace ||
        (resource.kind === dashboardResourceKindIds.dashboardView && resource.id === "workspaces"),
      open: (resource, input) =>
        openSurfaceWidget(
          ctx,
          resource.kind === dashboardResourceKindIds.workspace
            ? dashboardWidgetIds.workspaceDetail
            : dashboardWidgetIds.workspacesOverview,
          resource,
          input,
        ),
    });

    ctx.commands.registerCommand(
      { id: dashboardCommandIds.openWorkspaces, label: "Open workspaces", category: "Dashboard", icon: "GitBranch" },
      { execute: () => ctx.resources.openResource(dashboardViewResource("workspaces"), { replaceActive: true }) },
    );
    ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
      commandId: dashboardCommandIds.openWorkspaces,
      order: 20,
    });
  },
});
