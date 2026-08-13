import type {
  ResourceRef,
  TreeAction,
  TreeContext,
  TreeNode,
  TreeViewSection,
  WorkbenchModuleContext,
} from "@pstdio/workbench";
import { createElement } from "react";
import { dashboardQueryClient } from "@/lib/query-client";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { WorkspaceFileChangeBadge, WorkspaceFileTreeIcon } from "./components/workspace-file-tree-presentation";
import { resolveWorkspaceDiffRequest } from "./components/workspace-widget-state";
import {
  workspaceDiffFilePath,
  workspaceDiffFilesQueryOptions,
  workspaceFilesQueryOptions,
} from "./data/workspace-queries";
import { absoluteWorkspaceEntryPath, workspaceDeleteResource, workspaceIdOf } from "./workspace-file-resource";

const OPEN_WORKSPACE_FILE_COMMAND = "dashboard.workspace.open-file";
const CREATE_WORKSPACE_FILE_ACTION = "workspace-file.create";
const COPY_WORKSPACE_ENTRY_PATH_ACTION = "workspace-entry.copy-path";
const COPY_WORKSPACE_ENTRY_RELATIVE_PATH_ACTION = "workspace-entry.copy-relative-path";
const DELETE_WORKSPACE_ENTRY_ACTION = "workspace-entry.delete";
const REVEAL_WORKSPACE_ENTRY_ACTION = "workspace-entry.reveal";

interface DesktopWorkspaceFileApi {
  getAppInfo(): Promise<{ platform: string }>;
  revealInFinder(path: string): Promise<void>;
}

const desktopWorkspaceFileApi = () =>
  (globalThis as typeof globalThis & { promptStudioDesktop?: DesktopWorkspaceFileApi }).promptStudioDesktop;

const createFileAction = (
  resource: ResourceRef,
  beginCreate: (resource: ResourceRef, parentPath: string) => void,
  parentPath = "",
): TreeAction => ({
  id: CREATE_WORKSPACE_FILE_ACTION,
  label: "New file",
  icon: "FilePlus2",
  run: () => beginCreate(resource, parentPath),
});

const deleteEntryAction = (
  ctx: WorkbenchModuleContext,
  resource: ResourceRef,
  path: string,
  type: "file" | "directory",
): TreeAction => ({
  id: DELETE_WORKSPACE_ENTRY_ACTION,
  label: type === "directory" ? "Delete folder" : "Delete file",
  icon: "Trash2",
  run: () => {
    ctx.layout.openPanel(dashboardWidgetIds.deleteWorkspaceEntry, {
      title: type === "directory" ? "Delete folder" : "Delete file",
      resource: workspaceDeleteResource(resource, path, type),
    });
  },
});

const copyPathAction = (ctx: WorkbenchModuleContext, resource: ResourceRef, path: string): TreeAction => ({
  id: COPY_WORKSPACE_ENTRY_PATH_ACTION,
  label: "Copy path",
  icon: "Copy",
  run: async () => {
    const absolutePath = absoluteWorkspaceEntryPath(resource, path);
    if (!absolutePath) throw new Error("Workspace path is missing.");
    await navigator.clipboard.writeText(absolutePath);
    ctx.notifications.show({ level: "success", title: "Path copied" });
  },
});

const copyRelativePathAction = (ctx: WorkbenchModuleContext, path: string): TreeAction => ({
  id: COPY_WORKSPACE_ENTRY_RELATIVE_PATH_ACTION,
  label: "Copy relative path",
  icon: "Copy",
  run: async () => {
    await navigator.clipboard.writeText(path);
    ctx.notifications.show({ level: "success", title: "Relative path copied" });
  },
});

const revealInFinderAction = (resource: ResourceRef, path: string): TreeAction => ({
  id: REVEAL_WORKSPACE_ENTRY_ACTION,
  label: "Reveal in Finder",
  icon: "FolderOpen",
  run: async () => {
    const absolutePath = absoluteWorkspaceEntryPath(resource, path);
    const desktopApi = desktopWorkspaceFileApi();
    if (!absolutePath || !desktopApi) throw new Error("Reveal in Finder is unavailable.");
    await desktopApi.revealInFinder(absolutePath);
  },
});

const finderAvailable = async () => {
  const desktopApi = desktopWorkspaceFileApi();
  if (!desktopApi) return false;
  try {
    return (await desktopApi.getAppInfo()).platform === "darwin";
  } catch {
    return false;
  }
};

export interface WorkspaceFileTreeActions {
  beginCreate(resource: ResourceRef, parentPath: string): void;
  cancelCreate(): void;
  commitCreate(resource: ResourceRef, parentPath: string, name: string): Promise<void>;
}

const inlineCreateNode = (resource: ResourceRef, parentPath: string, actions: WorkspaceFileTreeActions): TreeNode => ({
  id: `workspace-file:new:${parentPath || "root"}`,
  label: "New file",
  icon: "File",
  inlineInput: {
    ariaLabel: parentPath ? `New file name in ${parentPath}` : "New file name",
    placeholder: "file-name",
    onCommit: (name) => actions.commitCreate(resource, parentPath, name),
    onCancel: actions.cancelCreate,
  },
});

const fileNode = (
  ctx: WorkbenchModuleContext,
  resource: ResourceRef,
  entry: { path: string; name: string; type: "file" | "directory" },
  actions: WorkspaceFileTreeActions,
  options: { change?: string; revealInFinder: boolean },
): TreeNode => {
  const copyActions = [copyPathAction(ctx, resource, entry.path), copyRelativePathAction(ctx, entry.path)];
  const revealAction = options.revealInFinder ? [revealInFinderAction(resource, entry.path)] : [];
  const deleteAction = deleteEntryAction(ctx, resource, entry.path, entry.type);
  if (entry.type === "directory") {
    const createAction = createFileAction(resource, actions.beginCreate, entry.path);
    return {
      id: entry.path,
      label: entry.name,
      collapsible: true,
      contextMenuActions: [createAction, ...copyActions, ...revealAction, deleteAction],
      showContextMenuTrigger: false,
    };
  }

  return {
    id: entry.path,
    label: entry.name,
    iconElement: createElement(WorkspaceFileTreeIcon, { name: entry.name }),
    endContent: options.change ? createElement(WorkspaceFileChangeBadge, { change: options.change }) : undefined,
    target: { kind: "command", commandId: OPEN_WORKSPACE_FILE_COMMAND, args: { path: entry.path } },
    contextMenuActions: [...copyActions, ...revealAction, deleteAction],
    showContextMenuTrigger: false,
  };
};

const unsupportedSection = (title: string, description: string): TreeViewSection[] => [
  { id: "workspace-files", emptyState: { title, description }, nodes: [] },
];

export const loadWorkspaceFileEntries = async (
  ctx: WorkbenchModuleContext,
  context: TreeContext,
  actions: WorkspaceFileTreeActions,
  pendingCreation: { workspaceId: string; parentPath: string } | undefined,
  path = "",
) => {
  const resource = context.resource;
  const workspaceId = workspaceIdOf(resource);
  if (!resource || !workspaceId) return unsupportedSection("Files unavailable", "Workspace details are missing.");
  const diffRequest = resolveWorkspaceDiffRequest({ resourceId: resource.id, metadata: resource.metadata });

  const [response, diffSummary, revealInFinder] = await Promise.all([
    dashboardQueryClient.fetchQuery(
      workspaceFilesQueryOptions(workspaceId, {
        ...(path ? { path } : {}),
        ...(context.filter ? { query: context.filter } : {}),
        limit: 500,
      }),
    ),
    diffRequest
      ? dashboardQueryClient.fetchQuery(workspaceDiffFilesQueryOptions(diffRequest.workspaceId, diffRequest.mode))
      : Promise.resolve(null),
    finderAvailable(),
  ]);
  const changeByPath = new Map(diffSummary?.files.map((file) => [workspaceDiffFilePath(file), file.change]));
  const nodes = response.entries.map((entry) =>
    fileNode(ctx, resource, entry, actions, { change: changeByPath.get(entry.path), revealInFinder }),
  );
  if (pendingCreation?.workspaceId === workspaceId && pendingCreation.parentPath === path) {
    nodes.unshift(inlineCreateNode(resource, path, actions));
  }
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
      actions: [createFileAction(resource, actions.beginCreate)],
      collapsible: false,
      emptyState: {
        title: context.filter ? "No matching files" : "No files",
        description: context.filter ? "Try a different search." : undefined,
      },
      nodes,
    },
  ];
};
