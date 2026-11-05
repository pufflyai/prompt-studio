import {
  type ResourceRef,
  resourceContextMenuPath,
  type WorkbenchModuleContext,
  workbenchResourceMetadataContextKey,
  workbenchResourceTypeContextKey,
} from "@pstdio/workbench";
import { dashboardCommandIds } from "@/shared/app/commands";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { deleteDashboardWorkspace } from "@/shared/workspaces/workspace-actions";

export { openWorkspaceTerminalResource } from "./workspace-host-actions";

const workspaceLabel = (resource: ResourceRef) => {
  const shorthand = resource.metadata?.workspaceShorthand;
  return typeof shorthand === "string" ? shorthand : (resource.label ?? resource.id ?? "workspace");
};
// The table, selected-resource breadcrumb, and tree resource menus all run the same
// action, so a workspace behaves identically wherever it is surfaced. These views
// listen to synced rows, so the action only needs to fire the write.
export const deleteWorkspaceResource = async (ctx: WorkbenchModuleContext, resource: ResourceRef) => {
  if (!resource.id || resource.metadata?.workspaceReadOnly === true) return;
  await deleteDashboardWorkspace(resource.id);
  ctx.notifications.show({ level: "success", title: `Deleted workspace ${workspaceLabel(resource)}` });
};
export const openRenameWorkspaceResource = (ctx: WorkbenchModuleContext, resource: ResourceRef) => {
  if (!resource.id || resource.metadata?.workspaceReadOnly === true) return;
  ctx.overlays.openOverlay(dashboardWidgetIds.renameWorkspace, { title: "Rename workspace", resource });
};
// The default workspace (root repo) is permanent: hide every action when the active or
// right-clicked resource is the default workspace.
const mutableWorkspaceWhen = `!${workbenchResourceMetadataContextKey("workspaceReadOnly")} && ${workbenchResourceTypeContextKey} == "workspace" && !${workbenchResourceMetadataContextKey("workspaceIsDefault")}`;
const workspaceTerminalActionWhen = `!${workbenchResourceMetadataContextKey("workspaceReadOnly")} && ${workbenchResourceTypeContextKey} == "workspace" && ${workbenchResourceMetadataContextKey("workspaceExecutionKind")} == "local" && ${workbenchResourceMetadataContextKey("workspaceProviderState")} == "ready"`;
const workspaceDeleteActionWhen = `${mutableWorkspaceWhen} && ${workbenchResourceMetadataContextKey("workspaceSupportsDelete")}`;
const workspaceActions = [
  {
    commandId: dashboardCommandIds.renameWorkspace,
    label: "Rename workspace",
    icon: "Pencil",
    order: 10,
    when: mutableWorkspaceWhen,
  },
  {
    commandId: dashboardCommandIds.deleteWorkspace,
    label: "Delete workspace",
    icon: "Trash2",
    order: 30,
    when: workspaceDeleteActionWhen,
  },
] as const;
const workspaceTerminalAction = {
  commandId: dashboardCommandIds.openWorkspaceTerminal,
  label: "Open terminal",
  icon: "SquareTerminal",
  order: 5,
  when: workspaceTerminalActionWhen,
} as const;
const workspaceActionGroup = "kernel";
export const registerWorkspaceResourceActions = (ctx: WorkbenchModuleContext) => {
  ctx.commands.registerCommand(
    { id: dashboardCommandIds.renameWorkspace, label: "Rename workspace", category: "Workspace", icon: "Pencil" },
    { execute: (_args, context) => context?.resource && openRenameWorkspaceResource(ctx, context.resource) },
  );
  ctx.commands.registerCommand(
    { id: dashboardCommandIds.deleteWorkspace, label: "Delete workspace", category: "Workspace", icon: "Trash2" },
    { execute: (_args, context) => context?.resource && deleteWorkspaceResource(ctx, context.resource) },
  );
  for (const action of [workspaceTerminalAction, ...workspaceActions]) {
    ctx.layout.registerMenuItem(resourceContextMenuPath("workspace"), {
      commandId: action.commandId,
      label: action.label,
      icon: action.icon,
      when: action.when,
      group: workspaceActionGroup,
      order: action.order,
    });
  }
};
