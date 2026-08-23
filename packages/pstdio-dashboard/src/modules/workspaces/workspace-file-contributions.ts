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

const moveWorkspaceFile = async (
  ctx: WorkbenchModuleContext,
  resource: ResourceRef,
  sourcePath: string,
  parentPath: string,
) => {
  const workspaceId = workspaceIdOf(resource);
  if (!workspaceId) throw new Error("Workspace details are missing.");
  const fileName = sourcePath.split("/").at(-1);
  if (!fileName) throw new Error("Workspace file path is missing.");
  const destinationPath = parentPath ? `${parentPath}/${fileName}` : fileName;
  if (destinationPath === sourcePath) return;
  const selected = ctx.renderers.getTreeState(dashboardWidgetIds.workspaceFileTree).selectedNodeId === sourcePath;

  await getApiClient().workspaces.moveFile(workspaceId, sourcePath, destinationPath);
  dashboardQueryClient.removeQueries({ queryKey: workspaceFileQueryOptions(workspaceId, sourcePath).queryKey });
  if (parentPath) ctx.renderers.setNodeExpanded(dashboardWidgetIds.workspaceFileTree, parentPath, true);
  await refreshWorkspaceFiles(ctx, workspaceId);
  if (!selected) return;
  ctx.renderers.setSelectedNode(dashboardWidgetIds.workspaceFileTree, destinationPath);
  await ctx.resources.openResource(workspaceFileResource(resource, destinationPath), { replaceActive: true });
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
      return treeActions.moveFile(context.resource, source.id, target?.id ?? "");
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
      const name = rawName.trim();
      if (!name || name === "." || name === ".." || name.includes("/") || name.includes("\\")) {
        throw new Error(`Enter a ${type === "directory" ? "folder" : "file"} name without folders.`);
      }
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
    moveFile: (resource, sourcePath, parentPath) => moveWorkspaceFile(ctx, resource, sourcePath, parentPath),
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
