import type {
  ResourceRef,
  TreeAction,
  TreeContext,
  TreeNode,
  TreeViewSection,
  WorkbenchModuleContext,
} from "@pstdio/workbench";
import { getApiClient } from "@/lib/api";
import { dashboardQueryClient } from "@/lib/query-client";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import {
  invalidateWorkspaceFileData,
  workspaceFileQueryOptions,
  workspaceFilesQueryOptions,
} from "./data/workspace-queries";

const OPEN_WORKSPACE_FILE_COMMAND = "dashboard.workspace.open-file";
const CREATE_WORKSPACE_FILE_ACTION = "workspace-file.create";
const DELETE_WORKSPACE_FILE_ACTION = "workspace-file.delete";

const metadataString = (resource: ResourceRef | undefined, key: string) => {
  const value = resource?.metadata?.[key];
  return typeof value === "string" ? value : undefined;
};

const workspaceIdOf = (resource: ResourceRef | undefined) => metadataString(resource, "workspaceId") ?? resource?.id;

const fileResource = (resource: ResourceRef, path: string): ResourceRef => ({
  ...resource,
  metadata: {
    ...resource.metadata,
    workspaceView: "files",
    workspaceFilePath: path,
  },
});

const workspaceResource = (resource: ResourceRef): ResourceRef => {
  const { workspaceFilePath: _workspaceFilePath, ...metadata } = resource.metadata ?? {};
  return { ...resource, metadata: { ...metadata, workspaceView: "files" } };
};

const filePathArg = (rawArgs: unknown) => {
  const path = (rawArgs as { path?: unknown } | undefined)?.path;
  if (typeof path !== "string" || !path.trim()) throw new Error("File path is required.");
  return path.trim();
};

const refreshWorkspaceFiles = async (ctx: WorkbenchModuleContext, workspaceId: string) => {
  await invalidateWorkspaceFileData(dashboardQueryClient, workspaceId);
  ctx.renderers.refresh(dashboardWidgetIds.workspaceFileTree);
  ctx.renderers.refreshFileRenderer(dashboardWidgetIds.workspaceFileRenderer);
};

export const createWorkspaceFile = async (ctx: WorkbenchModuleContext, resource: ResourceRef, rawArgs: unknown) => {
  const workspaceId = workspaceIdOf(resource);
  if (!workspaceId) throw new Error("Workspace details are missing.");
  const path = filePathArg(rawArgs);
  const created = await getApiClient().workspaces.createFile(workspaceId, path, { content: "" });
  dashboardQueryClient.setQueryData(workspaceFileQueryOptions(workspaceId, path).queryKey, created);
  await refreshWorkspaceFiles(ctx, workspaceId);
  ctx.renderers.setSelectedNode(dashboardWidgetIds.workspaceFileTree, path);
  await ctx.resources.openResource(fileResource(resource, path), { replaceActive: true });
  ctx.notifications.show({ level: "success", title: `Created ${path}` });
};

export const deleteWorkspaceFile = async (ctx: WorkbenchModuleContext, resource: ResourceRef) => {
  const workspaceId = workspaceIdOf(resource);
  const path = metadataString(resource, "workspaceFilePath");
  if (!workspaceId || !path) throw new Error("Workspace file details are missing.");
  await getApiClient().workspaces.deleteFile(workspaceId, path);
  dashboardQueryClient.removeQueries({ queryKey: workspaceFileQueryOptions(workspaceId, path).queryKey });
  await refreshWorkspaceFiles(ctx, workspaceId);
  ctx.renderers.setSelectedNode(dashboardWidgetIds.workspaceFileTree, undefined);
  await ctx.resources.openResource(workspaceResource(resource), { replaceActive: true });
  ctx.notifications.show({ level: "success", title: `Deleted ${path}` });
};

const createFileAction = (ctx: WorkbenchModuleContext, resource: ResourceRef, initialPath = ""): TreeAction => ({
  id: CREATE_WORKSPACE_FILE_ACTION,
  label: "New file",
  icon: "FilePlus2",
  args: { path: initialPath },
  params: {
    path: {
      type: "text",
      label: "File path",
      description: "Use a path inside an existing folder.",
      required: true,
      defaultValue: initialPath,
    },
  },
  submitLabel: "Create",
  run: (args) => createWorkspaceFile(ctx, resource, args),
});

const deleteFileAction = (ctx: WorkbenchModuleContext, resource: ResourceRef, path: string): TreeAction => ({
  id: DELETE_WORKSPACE_FILE_ACTION,
  label: "Delete file",
  icon: "Trash2",
  run: () => {
    ctx.layout.openPanel(dashboardWidgetIds.deleteWorkspaceFile, {
      title: "Delete file",
      resource: fileResource(resource, path),
    });
  },
});

const fileNode = (
  ctx: WorkbenchModuleContext,
  resource: ResourceRef,
  entry: { path: string; name: string; type: "file" | "directory" },
): TreeNode => {
  if (entry.type === "directory") {
    return {
      id: entry.path,
      label: entry.name,
      icon: "Folder",
      collapsible: true,
      actions: [createFileAction(ctx, resource, `${entry.path}/`)],
    };
  }

  const deleteAction = deleteFileAction(ctx, resource, entry.path);
  return {
    id: entry.path,
    label: entry.name,
    icon: "File",
    target: { kind: "command", commandId: OPEN_WORKSPACE_FILE_COMMAND, args: { path: entry.path } },
    actions: [deleteAction],
    contextMenuActions: [deleteAction],
  };
};

const unsupportedSection = (title: string, description: string): TreeViewSection[] => [
  { id: "workspace-files", emptyState: { title, description }, nodes: [] },
];

const loadFileEntries = async (ctx: WorkbenchModuleContext, context: TreeContext, path?: string) => {
  const resource = context.resource;
  const workspaceId = workspaceIdOf(resource);
  if (!resource || !workspaceId) return unsupportedSection("Files unavailable", "Workspace details are missing.");

  const response = await dashboardQueryClient.fetchQuery(
    workspaceFilesQueryOptions(workspaceId, {
      ...(path ? { path } : {}),
      ...(context.filter ? { query: context.filter } : {}),
      limit: 500,
    }),
  );
  const nodes = response.entries.map((entry) => fileNode(ctx, resource, entry));
  if (response.truncated) {
    nodes.push({
      id: "workspace-files:truncated",
      label: "Showing the first 500 matches. Refine your search.",
      rowVariant: "empty-state",
      disabled: true,
    });
  }
  return [
    {
      id: "workspace-files",
      label: "Files",
      actions: [createFileAction(ctx, resource)],
      collapsible: false,
      emptyState: {
        title: context.filter ? "No matching files" : "No files",
        description: context.filter ? "Try a different search." : undefined,
      },
      nodes,
    },
  ];
};

export const registerWorkspaceFileContributions = (ctx: WorkbenchModuleContext) => {
  ctx.commands.registerCommand(
    { id: OPEN_WORKSPACE_FILE_COMMAND, label: "Open workspace file", category: "Workspace" },
    {
      execute: async (rawArgs) => {
        const path = (rawArgs as { path?: unknown } | undefined)?.path;
        const resource = ctx.getPrimaryResource();
        if (typeof path !== "string" || resource?.kind !== "workspace") return;
        ctx.renderers.setSelectedNode(dashboardWidgetIds.workspaceFileTree, path);
        return ctx.resources.openResource(fileResource(resource, path), { replaceActive: true });
      },
    },
  );

  ctx.renderers.registerTreeRenderer({
    id: dashboardWidgetIds.workspaceFileTree,
    title: "Files",
    icon: "Files",
    searchable: true,
    searchPlaceholder: "Search files",
    getBody: async (context) => {
      const selectedPath = metadataString(context.resource, "workspaceFilePath");
      if (selectedPath) ctx.renderers.setSelectedNode(dashboardWidgetIds.workspaceFileTree, selectedPath);
      return loadFileEntries(ctx, context);
    },
    getChildren: (node, context) => loadFileEntries(ctx, context, node.id).then((sections) => sections[0]?.nodes ?? []),
  });

  ctx.renderers.registerFileRenderer({
    id: dashboardWidgetIds.workspaceFileRenderer,
    title: "Workspace file",
    resourceKind: "workspace",
    load: async (resource) => {
      const workspaceId = workspaceIdOf(resource);
      const path = metadataString(resource, "workspaceFilePath");
      if (!workspaceId || !path) {
        return {
          editable: false,
          emptyState: { title: "Select a file", description: "Choose a file from the Files panel." },
        };
      }
      const file = await dashboardQueryClient.fetchQuery(workspaceFileQueryOptions(workspaceId, path));
      return {
        fileName: file.file_name,
        mimeType: file.mime_type,
        content: file.content,
        dataUrl: file.data_url,
        editable: file.editable,
        textRenderer: file.encoding === "utf8" ? ("monaco" as const) : ("automatic" as const),
      };
    },
    save: async (resource, content) => {
      const workspaceId = workspaceIdOf(resource);
      const path = metadataString(resource, "workspaceFilePath");
      if (!workspaceId || !path) return;
      const updated = await getApiClient().workspaces.writeFile(workspaceId, path, { content });
      dashboardQueryClient.setQueryData(workspaceFileQueryOptions(workspaceId, path).queryKey, updated);
      await invalidateWorkspaceFileData(dashboardQueryClient, workspaceId);
      ctx.renderers.refresh(dashboardWidgetIds.workspaceFileTree);
      ctx.renderers.refreshFileRenderer(dashboardWidgetIds.workspaceFileRenderer);
    },
  });
};
