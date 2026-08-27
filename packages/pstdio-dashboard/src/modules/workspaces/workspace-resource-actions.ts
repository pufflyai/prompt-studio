import {
  type ResourceRef,
  resourceContextMenuPath,
  type WorkbenchModuleContext,
  workbenchResourceKindContextKey,
  workbenchResourceMetadataContextKey,
} from "@pstdio/workbench";
import {
  openWorkbenchTerminal,
  WORKBENCH_TERMINAL_LAUNCHER_WIDGET_ID,
  WORKBENCH_TERMINAL_WIDGET_ID,
} from "@pstdio/workbench/react";
import { dashboardCommandIds } from "@/shared/app/commands";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { archiveDashboardWorkspace, deleteDashboardWorkspace } from "@/shared/workspaces/workspace-actions";
import {
  createDashboardWorkspaceOptionResource,
  createDashboardWorkspaceOptions,
} from "@/shared/workspaces/workspace-options";

const autoOpenedWorkspaceTerminalUris = new WeakMap<WorkbenchModuleContext, Set<string>>();

const getAutoOpenedWorkspaceTerminalUris = (ctx: WorkbenchModuleContext) => {
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

const isLocalReadyWorkspace = (resource: ResourceRef) =>
  resource.metadata?.workspaceExecutionKind === "local" &&
  resource.metadata.workspaceProviderState === "ready" &&
  typeof resource.metadata.workspacePath === "string" &&
  resource.metadata.workspacePath.length > 0;

const resolveWorkspaceTerminalResource = (ctx: WorkbenchModuleContext, resource: ResourceRef) => {
  if (typeof resource.metadata?.workspacePath === "string" && resource.metadata.workspacePath.length > 0) {
    return resource;
  }

  const projectId = getDashboardSelectedProjectId(ctx);
  const workspace = createDashboardWorkspaceOptions(projectId).find((option) => option.id === resource.id);
  if (!workspace?.workspacePath) return resource;

  const canonical = createDashboardWorkspaceOptionResource(workspace, projectId);
  return {
    ...resource,
    metadata: {
      ...canonical.metadata,
      ...resource.metadata,
      workspacePath: workspace.workspacePath,
    },
  };
};

// The table, selected-resource breadcrumb, and tree resource menus all run the same
// action, so a workspace behaves identically wherever it is surfaced. These views
// listen to synced rows, so the action only needs to fire the write.
export const archiveWorkspaceResource = async (ctx: WorkbenchModuleContext, resource: ResourceRef) => {
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

export const deleteWorkspaceResource = async (ctx: WorkbenchModuleContext, resource: ResourceRef) => {
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

export const openRenameWorkspaceResource = (ctx: WorkbenchModuleContext, resource: ResourceRef) => {
  if (!resource.id) return;

  ctx.layout.openPanel(dashboardWidgetIds.renameWorkspace, { title: "Rename workspace", resource, closable: true });
};

export const openWorkspaceTerminalResource = (ctx: WorkbenchModuleContext, resource: ResourceRef) => {
  if (!resource.id) return;
  if (!ctx.layout.getPanel(WORKBENCH_TERMINAL_WIDGET_ID)) return;
  const terminalResource = resolveWorkspaceTerminalResource(ctx, resource);
  if (!isLocalReadyWorkspace(terminalResource)) return;

  return openWorkbenchTerminal(ctx, { resource: terminalResource });
};

export const ensureWorkspaceTerminalResource = (ctx: WorkbenchModuleContext, resource: ResourceRef) => {
  if (!resource.id) return;
  if (!ctx.layout.getPanel(WORKBENCH_TERMINAL_WIDGET_ID)) return;

  const terminalResource = resolveWorkspaceTerminalResource(ctx, resource);
  if (!isLocalReadyWorkspace(terminalResource)) return;
  const autoOpenedUris = getAutoOpenedWorkspaceTerminalUris(ctx);
  const existing = ctx.layout
    .getLayout()
    .regions.secondary.widgets.find(
      (placement) =>
        placement.contributionId === WORKBENCH_TERMINAL_WIDGET_ID && placement.resourceUri === resource.uri,
    );
  if (!existing && autoOpenedUris.has(resource.uri)) {
    return ctx.layout.openPanel(WORKBENCH_TERMINAL_LAUNCHER_WIDGET_ID, {
      hiddenByDefault: true,
      pinned: true,
      title: "Terminal",
    });
  }

  if (existing) {
    if (existing.resource?.metadata?.workspacePath === terminalResource.metadata?.workspacePath) return existing;
    return ctx.layout.updatePanel(existing.widgetId, {
      resource: terminalResource,
      title: existing.title,
    });
  }

  autoOpenedUris.add(resource.uri);
  return openWorkbenchTerminal(ctx, { resource: terminalResource, reveal: false });
};

// The default workspace (root repo) is permanent: hide every action when the active or
// right-clicked resource is the default workspace.
const mutableWorkspaceWhen = `${workbenchResourceKindContextKey} == "workspace" && !${workbenchResourceMetadataContextKey("workspaceIsDefault")}`;
const workspaceTerminalActionWhen = `${workbenchResourceKindContextKey} == "workspace" && ${workbenchResourceMetadataContextKey("workspaceExecutionKind")} == "local" && ${workbenchResourceMetadataContextKey("workspaceProviderState")} == "ready"`;
const workspaceArchiveActionWhen = `${mutableWorkspaceWhen} && ${workbenchResourceMetadataContextKey("workspaceSupportsArchive")}`;
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
    commandId: dashboardCommandIds.archiveWorkspace,
    label: "Archive workspace",
    icon: "Archive",
    order: 20,
    when: workspaceArchiveActionWhen,
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
