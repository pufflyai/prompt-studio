import {
  type ResourceRef,
  resourceContextMenuPath,
  type WorkbenchModuleContributionContext,
  workbenchResourceKindContextKey,
  workbenchResourceMetadataContextKey,
  workbenchTopHeaderTrailingMenuPath,
} from "@pstdio/workbench/core";
import {
  openWorkbenchTerminal,
  WORKBENCH_TERMINAL_LAUNCHER_WIDGET_ID,
  WORKBENCH_TERMINAL_WIDGET_ID,
} from "@pstdio/workbench/react";
import { dashboardCommandIds } from "@/shared/app/commands";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { archiveDashboardWorkspace, deleteDashboardWorkspace } from "@/shared/workspaces/workspace-actions";

const autoOpenedWorkspaceTerminalUris = new WeakMap<WorkbenchModuleContributionContext, Set<string>>();

const getAutoOpenedWorkspaceTerminalUris = (ctx: WorkbenchModuleContributionContext) => {
  let uris = autoOpenedWorkspaceTerminalUris.get(ctx);
  if (!uris) {
    uris = new Set();
    autoOpenedWorkspaceTerminalUris.set(ctx, uris);
  }
  return uris;
};

const workspaceLabel = (resource: ResourceRef) => {
  const shorthand = resource.metadata?.workspaceShorthand;
  return typeof shorthand === "string" ? shorthand : (resource.label ?? resource.id ?? "workspace");
};

// The board, the workspace header overflow menu, and tree context menus all run the
// same action, so a workspace behaves identically wherever it is surfaced. The board
// listens to synced rows, so an archived/deleted workspace disappears once the write
// streams back — the action just fires the call.
export const archiveWorkspaceResource = async (ctx: WorkbenchModuleContributionContext, resource: ResourceRef) => {
  if (!resource.id) return;

  try {
    await archiveDashboardWorkspace(resource.id);
    ctx.notifications.show({ level: "success", title: `Archived workspace ${workspaceLabel(resource)}` });
  } catch (error) {
    ctx.notifications.show({
      level: "error",
      title: "Failed to archive workspace",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

export const deleteWorkspaceResource = async (ctx: WorkbenchModuleContributionContext, resource: ResourceRef) => {
  if (!resource.id) return;

  try {
    await deleteDashboardWorkspace(resource.id);
    ctx.notifications.show({ level: "success", title: `Deleted workspace ${workspaceLabel(resource)}` });
  } catch (error) {
    ctx.notifications.show({
      level: "error",
      title: "Failed to delete workspace",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

export const openRenameWorkspaceResource = (ctx: WorkbenchModuleContributionContext, resource: ResourceRef) => {
  if (!resource.id) return;

  ctx.layout.openWidget(dashboardWidgetIds.renameWorkspace, { title: "Rename workspace", resource });
};

export const openWorkspaceTerminalResource = (ctx: WorkbenchModuleContributionContext, resource: ResourceRef) => {
  if (!resource.id) return;
  if (!ctx.layout.getWidget(WORKBENCH_TERMINAL_WIDGET_ID)) return;

  return openWorkbenchTerminal(ctx, { resource });
};

export const ensureWorkspaceTerminalResource = (ctx: WorkbenchModuleContributionContext, resource: ResourceRef) => {
  if (!resource.id) return;
  if (!ctx.layout.getWidget(WORKBENCH_TERMINAL_WIDGET_ID)) return;

  const autoOpenedUris = getAutoOpenedWorkspaceTerminalUris(ctx);
  const existing = ctx.layout
    .getLayout()
    .regions.secondary.widgets.find(
      (placement) =>
        placement.contributionId === WORKBENCH_TERMINAL_WIDGET_ID && placement.resourceUri === resource.uri,
    );
  if (!existing && autoOpenedUris.has(resource.uri)) {
    return ctx.layout.openWidget(WORKBENCH_TERMINAL_LAUNCHER_WIDGET_ID, {
      hiddenByDefault: true,
      pinned: true,
      title: "Terminal",
    });
  }

  ctx.layout.setRegionVisible("secondary", true);
  ctx.panels.setOpen("secondary", true);
  if (existing) return existing;

  autoOpenedUris.add(resource.uri);
  return openWorkspaceTerminalResource(ctx, resource);
};

// The default workspace (root repo) is permanent: hide every action when the active or
// right-clicked resource is the default workspace.
const workspaceActionWhen = `${workbenchResourceKindContextKey} == "workspace" && !${workbenchResourceMetadataContextKey("workspaceIsDefault")}`;
const workspaceTerminalActionWhen = `${workbenchResourceKindContextKey} == "workspace"`;

const workspaceActions = [
  { commandId: dashboardCommandIds.renameWorkspace, label: "Rename workspace", icon: "Pencil", order: 10 },
  { commandId: dashboardCommandIds.archiveWorkspace, label: "Archive workspace", icon: "Archive", order: 20 },
  { commandId: dashboardCommandIds.deleteWorkspace, label: "Delete workspace", icon: "Trash2", order: 30 },
] as const;
const workspaceTerminalAction = {
  commandId: dashboardCommandIds.openWorkspaceTerminal,
  label: "Open terminal",
  icon: "SquareTerminal",
  order: 5,
} as const;
const workspaceActionGroup = "kernel";

export const registerWorkspaceResourceActions = (ctx: WorkbenchModuleContributionContext) => {
  ctx.commands.registerCommand(
    {
      id: dashboardCommandIds.openWorkspaceTerminal,
      label: "Open terminal",
      category: "Workspace",
      icon: "SquareTerminal",
    },
    { execute: (_args, context) => context?.resource && openWorkspaceTerminalResource(ctx, context.resource) },
  );
  ctx.commands.registerCommand(
    { id: dashboardCommandIds.renameWorkspace, label: "Rename workspace", category: "Workspace", icon: "Pencil" },
    { execute: (_args, context) => context?.resource && openRenameWorkspaceResource(ctx, context.resource) },
  );
  ctx.commands.registerCommand(
    { id: dashboardCommandIds.archiveWorkspace, label: "Archive workspace", category: "Workspace", icon: "Archive" },
    { execute: (_args, context) => context?.resource && archiveWorkspaceResource(ctx, context.resource) },
  );
  ctx.commands.registerCommand(
    { id: dashboardCommandIds.deleteWorkspace, label: "Delete workspace", category: "Workspace", icon: "Trash2" },
    { execute: (_args, context) => context?.resource && deleteWorkspaceResource(ctx, context.resource) },
  );

  for (const action of [workspaceTerminalAction, ...workspaceActions]) {
    ctx.layout.registerMenuItem(workbenchTopHeaderTrailingMenuPath, {
      commandId: action.commandId,
      label: action.label,
      icon: action.icon,
      when:
        action.commandId === dashboardCommandIds.openWorkspaceTerminal
          ? workspaceTerminalActionWhen
          : workspaceActionWhen,
      group: workspaceActionGroup,
      overflowLabel: "Workspace actions",
      order: action.order,
    });
    ctx.layout.registerMenuItem(resourceContextMenuPath("workspace"), {
      commandId: action.commandId,
      label: action.label,
      icon: action.icon,
      when:
        action.commandId === dashboardCommandIds.openWorkspaceTerminal
          ? workspaceTerminalActionWhen
          : workspaceActionWhen,
      group: workspaceActionGroup,
      order: action.order,
    });
  }
};
