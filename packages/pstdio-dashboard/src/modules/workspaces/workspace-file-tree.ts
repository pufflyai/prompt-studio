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
const CREATE_WORKSPACE_DIRECTORY_ACTION = "workspace-directory.create";
const RENAME_WORKSPACE_ENTRY_ACTION = "workspace-entry.rename";
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

type WorkspaceEntryCreationType = "file" | "directory";

const createEntryAction = (
  resource: ResourceRef,
  beginCreate: (resource: ResourceRef, parentPath: string, type: WorkspaceEntryCreationType) => void,
  type: WorkspaceEntryCreationType,
  parentPath = "",
): TreeAction => ({
  id: type === "directory" ? CREATE_WORKSPACE_DIRECTORY_ACTION : CREATE_WORKSPACE_FILE_ACTION,
  label: type === "directory" ? "New folder" : "New file",
  icon: type === "directory" ? "FolderPlus" : "FilePlus2",
  run: () => beginCreate(resource, parentPath, type),
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
      closable: true,
    });
  },
});

const renameEntryAction = (
  resource: ResourceRef,
  path: string,
  name: string,
  type: "file" | "directory",
  actions: WorkspaceFileTreeActions,
): TreeAction => ({
  id: RENAME_WORKSPACE_ENTRY_ACTION,
  label: "Rename",
  icon: "Pencil",
  args: { name },
  params: {
    name: {
      type: "text",
      label: type === "directory" ? "Folder name" : "File name",
      required: true,
    },
  },
  submitLabel: "Rename",
  run: (args) => actions.renameEntry(resource, path, type, args),
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
  beginCreate(resource: ResourceRef, parentPath: string, type: WorkspaceEntryCreationType): void;
  cancelCreate(): void;
  commitCreate(
    resource: ResourceRef,
    parentPath: string,
    type: WorkspaceEntryCreationType,
    name: string,
  ): Promise<void>;
  moveEntry(resource: ResourceRef, sourcePath: string, destinationPath: string): Promise<void>;
  renameEntry(resource: ResourceRef, path: string, type: WorkspaceEntryCreationType, args: unknown): Promise<void>;
}

const inlineCreateNode = (
  resource: ResourceRef,
  parentPath: string,
  type: WorkspaceEntryCreationType,
  actions: WorkspaceFileTreeActions,
): TreeNode => ({
  id: `workspace-${type}:new:${parentPath || "root"}`,
  label: type === "directory" ? "New folder" : "New file",
  icon: type === "directory" ? "Folder" : "File",
  inlineInput: {
    ariaLabel: parentPath
      ? `New ${type === "directory" ? "folder" : "file"} name in ${parentPath}`
      : `New ${type === "directory" ? "folder" : "file"} name`,
    placeholder: type === "directory" ? "folder-name" : "file-name",
    onCommit: (name) => actions.commitCreate(resource, parentPath, type, name),
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
  const renameAction = renameEntryAction(resource, entry.path, entry.name, entry.type, actions);
  const revealAction = options.revealInFinder ? [revealInFinderAction(resource, entry.path)] : [];
  const deleteAction = deleteEntryAction(ctx, resource, entry.path, entry.type);
  if (entry.type === "directory") {
    const createActions = [
      createEntryAction(resource, actions.beginCreate, "file", entry.path),
      createEntryAction(resource, actions.beginCreate, "directory", entry.path),
    ];
    return {
      id: entry.path,
      label: entry.name,
      collapsible: true,
      canDrag: true,
      canDrop: true,
      contextMenuActions: [...createActions, renameAction, ...copyActions, ...revealAction, deleteAction],
      showContextMenuTrigger: false,
    };
  }

  return {
    id: entry.path,
    label: entry.name,
    iconElement: createElement(WorkspaceFileTreeIcon, { name: entry.name }),
    endContent: options.change ? createElement(WorkspaceFileChangeBadge, { change: options.change }) : undefined,
    target: { kind: "command", commandId: OPEN_WORKSPACE_FILE_COMMAND, args: { path: entry.path } },
    contextMenuActions: [renameAction, ...copyActions, ...revealAction, deleteAction],
    showContextMenuTrigger: false,
    canDrag: true,
  };
};

const unsupportedSection = (title: string, description: string): TreeViewSection[] => [
  { id: "workspace-files", emptyState: { title, description }, nodes: [] },
];

export const loadWorkspaceFileEntries = async (
  ctx: WorkbenchModuleContext,
  context: TreeContext,
  actions: WorkspaceFileTreeActions,
  pendingCreation: { workspaceId: string; parentPath: string; type: WorkspaceEntryCreationType } | undefined,
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
    nodes.unshift(inlineCreateNode(resource, path, pendingCreation.type, actions));
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
      actions: [
        createEntryAction(resource, actions.beginCreate, "file"),
        createEntryAction(resource, actions.beginCreate, "directory"),
      ],
      collapsible: false,
      emptyState: {
        title: context.filter ? "No matching files" : "No files",
        description: context.filter ? "Try a different search." : undefined,
      },
      nodes,
    },
  ];
};
