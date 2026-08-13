import type { ResourceRef, TreeContext, TreeNode, TreeViewSection, WorkbenchModuleContext } from "@pstdio/workbench";
import { getApiClient } from "@/lib/api";
import { dashboardQueryClient } from "@/lib/query-client";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import {
  invalidateWorkspaceFileData,
  workspaceFileQueryOptions,
  workspaceFilesQueryOptions,
} from "./data/workspace-queries";

const OPEN_WORKSPACE_FILE_COMMAND = "dashboard.workspace.open-file";

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

const fileNode = (entry: { path: string; name: string; type: "file" | "directory" }): TreeNode =>
  entry.type === "directory"
    ? {
        id: entry.path,
        label: entry.name,
        icon: "Folder",
        collapsible: true,
      }
    : {
        id: entry.path,
        label: entry.name,
        icon: "File",
        target: { kind: "command", commandId: OPEN_WORKSPACE_FILE_COMMAND, args: { path: entry.path } },
      };

const unsupportedSection = (title: string, description: string): TreeViewSection[] => [
  { id: "workspace-files", emptyState: { title, description }, nodes: [] },
];

const loadFileEntries = async (context: TreeContext, path?: string) => {
  const workspaceId = workspaceIdOf(context.resource);
  if (!context.resource || !workspaceId)
    return unsupportedSection("Files unavailable", "Workspace details are missing.");
  if (context.resource.metadata?.workspaceType === "current_branch") {
    return unsupportedSection("Files unavailable", "File browsing requires a worktree-backed workspace.");
  }

  const response = await dashboardQueryClient.fetchQuery(
    workspaceFilesQueryOptions(workspaceId, {
      ...(path ? { path } : {}),
      ...(context.filter ? { query: context.filter } : {}),
      limit: 500,
    }),
  );
  const nodes = response.entries.map(fileNode);
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
      return loadFileEntries(context);
    },
    getChildren: (node, context) => loadFileEntries(context, node.id).then((sections) => sections[0]?.nodes ?? []),
  });

  ctx.renderers.registerFileRenderer({
    id: dashboardWidgetIds.workspaceFileRenderer,
    title: "Workspace file",
    resourceKind: "workspace",
    load: async (resource) => {
      const workspaceId = workspaceIdOf(resource);
      const path = metadataString(resource, "workspaceFilePath");
      if (resource?.metadata?.workspaceType === "current_branch") {
        return {
          editable: false,
          emptyState: {
            title: "Files unavailable",
            description: "File browsing requires a worktree-backed workspace.",
          },
        };
      }
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
