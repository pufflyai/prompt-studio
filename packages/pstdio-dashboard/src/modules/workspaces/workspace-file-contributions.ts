import type { ResourceRef, WorkbenchModuleContext } from "@pstdio/workbench";
import { getApiClient } from "@/lib/api";
import { dashboardQueryClient } from "@/lib/query-client";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { invalidateWorkspaceFileData, workspaceFileQueryOptions } from "./data/workspace-queries";
import {
  workspaceFileResource,
  workspaceIdOf,
  workspaceMetadataString,
  workspaceRootResource,
} from "./workspace-file-resource";
import { loadWorkspaceFileEntries, type WorkspaceFileTreeActions } from "./workspace-file-tree";

const OPEN_WORKSPACE_FILE_COMMAND = "dashboard.workspace.open-file";

const filePathArg = (rawArgs: unknown) => {
  const path = (rawArgs as { path?: unknown } | undefined)?.path;
  if (typeof path !== "string" || !path.trim()) throw new Error("File path is required.");
  return path.trim();
};

const refreshWorkspaceFiles = async (ctx: WorkbenchModuleContext, workspaceId: string) => {
  await invalidateWorkspaceFileData(dashboardQueryClient, workspaceId);
  ctx.renderers.refresh(dashboardWidgetIds.workspaceFileTree);
};

export const createWorkspaceFile = async (ctx: WorkbenchModuleContext, resource: ResourceRef, rawArgs: unknown) => {
  const workspaceId = workspaceIdOf(resource);
  if (!workspaceId) throw new Error("Workspace details are missing.");
  const path = filePathArg(rawArgs);
  const created = await getApiClient().workspaces.createFile(workspaceId, path, { content: "" });
  dashboardQueryClient.setQueryData(workspaceFileQueryOptions(workspaceId, path).queryKey, created);
  await refreshWorkspaceFiles(ctx, workspaceId);
  ctx.renderers.setSelectedNode(dashboardWidgetIds.workspaceFileTree, path);
  await ctx.resources.openResource(workspaceFileResource(resource, path), { replaceActive: true });
};

const createWorkspaceDirectory = async (ctx: WorkbenchModuleContext, resource: ResourceRef, path: string) => {
  const workspaceId = workspaceIdOf(resource);
  if (!workspaceId) throw new Error("Workspace details are missing.");
  await getApiClient().workspaces.createDirectory(workspaceId, path);
  await refreshWorkspaceFiles(ctx, workspaceId);
  ctx.renderers.setNodeExpanded(dashboardWidgetIds.workspaceFileTree, path, true);
};

const remapEntryPath = (path: string | undefined, sourcePath: string, destinationPath: string) => {
  if (path === sourcePath) return destinationPath;
  if (path?.startsWith(`${sourcePath}/`)) return `${destinationPath}${path.slice(sourcePath.length)}`;
  return path;
};

const moveWorkspaceEntry = async (
  ctx: WorkbenchModuleContext,
  resource: ResourceRef,
  sourcePath: string,
  destinationPath: string,
) => {
  const workspaceId = workspaceIdOf(resource);
  if (!workspaceId) throw new Error("Workspace details are missing.");
  if (destinationPath === sourcePath) return;
  const treeState = ctx.renderers.getTreeState(dashboardWidgetIds.workspaceFileTree);
  const selectedPath = remapEntryPath(treeState.selectedNodeId, sourcePath, destinationPath);
  const activePath = workspaceMetadataString(ctx.getPrimaryResource(), "workspaceFilePath");
  const movedActivePath = remapEntryPath(activePath, sourcePath, destinationPath);
  const expandedSourcePaths = treeState.expandedNodeIds.filter(
    (path) => path === sourcePath || path.startsWith(`${sourcePath}/`),
  );
  const movedExpandedPaths = expandedSourcePaths
    .map((path) => remapEntryPath(path, sourcePath, destinationPath))
    .filter((path): path is string => Boolean(path));

  await getApiClient().workspaces.moveEntry(workspaceId, sourcePath, destinationPath);
  dashboardQueryClient.removeQueries({
    predicate: (query) => {
      const [scope, queryWorkspaceId, kind, queryPath] = query.queryKey;
      return (
        scope === "workspace-files" &&
        queryWorkspaceId === workspaceId &&
        kind === "file" &&
        typeof queryPath === "string" &&
        (queryPath === sourcePath || queryPath.startsWith(`${sourcePath}/`))
      );
    },
  });
  const parentPath = destinationPath.split("/").slice(0, -1).join("/");
  if (parentPath) movedExpandedPaths.push(parentPath);
  await refreshWorkspaceFiles(ctx, workspaceId);
  for (const path of expandedSourcePaths) {
    ctx.renderers.setNodeExpanded(dashboardWidgetIds.workspaceFileTree, path, false);
  }
  for (const path of new Set(movedExpandedPaths)) {
    ctx.renderers.setNodeExpanded(dashboardWidgetIds.workspaceFileTree, path, true);
  }
  if (selectedPath !== treeState.selectedNodeId) {
    ctx.renderers.setSelectedNode(dashboardWidgetIds.workspaceFileTree, selectedPath);
  }
  if (movedActivePath !== activePath && movedActivePath) {
    await ctx.resources.openResource(workspaceFileResource(resource, movedActivePath), { replaceActive: true });
  }
};

const entryNameArg = (rawArgs: unknown, type: "file" | "directory") => {
  const value = (rawArgs as { name?: unknown } | undefined)?.name;
  const name = typeof value === "string" ? value.trim() : "";
  if (!name || name === "." || name === ".." || name.includes("/") || name.includes("\\")) {
    throw new Error(`Enter a ${type === "directory" ? "folder" : "file"} name without folders.`);
  }
  return name;
};

export const deleteWorkspaceEntry = async (ctx: WorkbenchModuleContext, resource: ResourceRef) => {
  const workspaceId = workspaceIdOf(resource);
  const path = workspaceMetadataString(resource, "workspaceDeletePath");
  const type = workspaceMetadataString(resource, "workspaceDeleteType");
  if (!workspaceId || !path || (type !== "file" && type !== "directory")) {
    throw new Error("Workspace entry details are missing.");
  }
  await getApiClient().workspaces.deleteEntry(workspaceId, path);
  dashboardQueryClient.removeQueries({
    predicate: (query) => {
      const [scope, queryWorkspaceId, kind, queryPath] = query.queryKey;
      return (
        scope === "workspace-files" &&
        queryWorkspaceId === workspaceId &&
        kind === "file" &&
        typeof queryPath === "string" &&
        (queryPath === path || queryPath.startsWith(`${path}/`))
      );
    },
  });
  await refreshWorkspaceFiles(ctx, workspaceId);
  const selectedPath = workspaceMetadataString(resource, "workspaceFilePath");
  const deletedSelection = selectedPath === path || (type === "directory" && selectedPath?.startsWith(`${path}/`));
  if (deletedSelection) {
    ctx.renderers.setSelectedNode(dashboardWidgetIds.workspaceFileTree, undefined);
    await ctx.resources.openResource(workspaceRootResource(resource), { replaceActive: true });
  }
  ctx.notifications.show({ level: "success", title: `Deleted ${path}` });
};

const registerWorkspaceFileTree = (
  ctx: WorkbenchModuleContext,
  treeActions: WorkspaceFileTreeActions,
  pendingCreation: () => { workspaceId: string; parentPath: string; type: "file" | "directory" } | undefined,
) => {
  ctx.renderers.registerTreeRenderer({
    id: dashboardWidgetIds.workspaceFileTree,
    title: "Files",
    icon: "Files",
    searchable: true,
    searchPlaceholder: "Search files",
    getBody: async (context) => {
      const selectedPath = workspaceMetadataString(context.resource, "workspaceFilePath");
      if (selectedPath) ctx.renderers.setSelectedNode(dashboardWidgetIds.workspaceFileTree, selectedPath);
      return loadWorkspaceFileEntries(ctx, context, treeActions, pendingCreation());
    },
    getChildren: (node, context) =>
      loadWorkspaceFileEntries(ctx, context, treeActions, pendingCreation(), node.id).then(
        (sections) => sections[0]?.nodes ?? [],
      ),
    moveNode: (source, target, context) => {
      if (!context.resource || !source.canDrag || (target && !target.canDrop)) return;
      const parentPath = target?.id ?? "";
      const name = source.id.split("/").at(-1);
      if (!name) return;
      const destinationPath = parentPath ? `${parentPath}/${name}` : name;
      return treeActions.moveEntry(context.resource, source.id, destinationPath);
    },
  });
};

const registerWorkspaceFileRenderer = (ctx: WorkbenchModuleContext) => {
  ctx.renderers.registerFileRenderer({
    id: dashboardWidgetIds.workspaceFileRenderer,
    title: "Workspace file",
    resourceKind: "workspace",
    load: async (resource) => {
      const workspaceId = workspaceIdOf(resource);
      const path = workspaceMetadataString(resource, "workspaceFilePath");
      if (!workspaceId || !path) {
        return {
          editable: false,
          emptyState: { title: "Select a file", description: "Choose a file from the Files panel." },
        };
      }
      const file = await dashboardQueryClient.fetchQuery(workspaceFileQueryOptions(workspaceId, path));
      return {
        fileName: file.file_name,
        filePath: file.path,
        mimeType: file.mime_type,
        content: file.content,
        dataUrl: file.data_url,
        editable: file.editable,
        textRenderer: file.encoding === "utf8" ? ("monaco" as const) : ("automatic" as const),
      };
    },
    save: async (resource, content) => {
      const workspaceId = workspaceIdOf(resource);
      const path = workspaceMetadataString(resource, "workspaceFilePath");
      if (!workspaceId || !path) return;
      const updated = await getApiClient().workspaces.writeFile(workspaceId, path, { content });
      dashboardQueryClient.setQueryData(workspaceFileQueryOptions(workspaceId, path).queryKey, updated);
      await invalidateWorkspaceFileData(dashboardQueryClient, workspaceId);
      ctx.renderers.refresh(dashboardWidgetIds.workspaceFileTree);
    },
  });
};

export const registerWorkspaceFileContributions = (ctx: WorkbenchModuleContext) => {
  let pendingCreation: { workspaceId: string; parentPath: string; type: "file" | "directory" } | undefined;
  const treeActions: WorkspaceFileTreeActions = {
    beginCreate: (resource, parentPath, type) => {
      const workspaceId = workspaceIdOf(resource);
      if (!workspaceId) throw new Error("Workspace details are missing.");
      pendingCreation = { workspaceId, parentPath, type };
      if (parentPath) ctx.renderers.setNodeExpanded(dashboardWidgetIds.workspaceFileTree, parentPath, true);
      ctx.renderers.refresh(dashboardWidgetIds.workspaceFileTree);
    },
    cancelCreate: () => {
      pendingCreation = undefined;
      ctx.renderers.refresh(dashboardWidgetIds.workspaceFileTree);
    },
    commitCreate: async (resource, parentPath, type, rawName) => {
      const name = entryNameArg({ name: rawName }, type);
      const previousPendingCreation = pendingCreation;
      pendingCreation = undefined;
      try {
        const path = parentPath ? `${parentPath}/${name}` : name;
        if (type === "directory") await createWorkspaceDirectory(ctx, resource, path);
        else await createWorkspaceFile(ctx, resource, { path });
      } catch (error) {
        pendingCreation = previousPendingCreation;
        throw error;
      }
    },
    moveEntry: (resource, sourcePath, destinationPath) =>
      moveWorkspaceEntry(ctx, resource, sourcePath, destinationPath),
    renameEntry: (resource, sourcePath, type, rawArgs) => {
      const name = entryNameArg(rawArgs, type);
      const parentPath = sourcePath.split("/").slice(0, -1).join("/");
      const destinationPath = parentPath ? `${parentPath}/${name}` : name;
      return moveWorkspaceEntry(ctx, resource, sourcePath, destinationPath);
    },
  };

  ctx.commands.registerCommand(
    { id: OPEN_WORKSPACE_FILE_COMMAND, label: "Open workspace file", category: "Workspace" },
    {
      execute: async (rawArgs) => {
        const path = (rawArgs as { path?: unknown } | undefined)?.path;
        const resource = ctx.getPrimaryResource();
        if (typeof path !== "string" || resource?.kind !== "workspace") return;
        ctx.renderers.setSelectedNode(dashboardWidgetIds.workspaceFileTree, path);
        return ctx.resources.openResource(workspaceFileResource(resource, path), { replaceActive: true });
      },
    },
  );

  registerWorkspaceFileTree(ctx, treeActions, () => pendingCreation);
  registerWorkspaceFileRenderer(ctx);
};
