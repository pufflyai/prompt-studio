import {
  type AccountDevice,
  type ExtensionWorkspace,
  type NavigationTargetPage,
  type ResourceRef,
  sessionBrowser,
} from "@pstdio/sdk/extensions";
import { workspacePages } from "./refs";

type DeviceOrder = Pick<AccountDevice, "id" | "name" | "online" | "current" | "lastSeenAt">;
export const groupDevices = <D extends DeviceOrder>(devices: D[]) =>
  [...devices].sort((a, b) => {
    if (a.current !== b.current) return a.current ? -1 : 1;
    if (a.online !== b.online) return a.online ? -1 : 1;
    return a.online
      ? a.name.localeCompare(b.name)
      : b.lastSeenAt.localeCompare(a.lastSeenAt) || a.name.localeCompare(b.name);
  });
export const workspaceKind = (workspace: ExtensionWorkspace) => {
  if (workspace.executionKind === "remote") return "Remote";
  return workspace.providerId === "pstdio.worktree" ? "Git worktree" : "Folder";
};
export const workspaceResource = (
  workspace: ExtensionWorkspace,
  projectId: string,
  metadata: ResourceRef["metadata"] = {},
): ResourceRef => ({
  type: "workspace",
  id: workspace.id,
  extensionId: "pstdio",
  projectId,
  ...(workspace.device ? { device: workspace.device } : {}),
  label: workspace.name || workspace.shorthand || workspace.id,
  icon: workspaceKind(workspace) === "Git worktree" ? "git-branch" : "folder",
  metadata: {
    workspaceId: workspace.id,
    workspaceShorthand: workspace.shorthand ?? workspace.id,
    workspaceIsDefault: Boolean(workspace.isDefault),
    workspaceReadOnly: Boolean(workspace.device),
    workspaceExecutionKind: workspace.executionKind ?? "local",
    workspaceProviderState: workspace.providerState ?? "provisioning",
    workspaceSupportsFiles:
      !workspace.device && workspace.executionKind === "local" && workspace.capabilities?.files !== "none",
    workspaceSupportsDiff: !workspace.device && !workspace.isDefault && workspace.capabilities?.diff === true,
    workspaceSupportsDelete: !workspace.device && !workspace.isDefault && workspace.capabilities?.delete === true,
    workspacePath: workspace.rootPath ?? "",
    workspaceType: workspaceKind(workspace),
    workspaceError: workspace.setupError ?? null,
    ...(workspace.branch ? { workspaceBranch: workspace.branch } : {}),
    ...metadata,
  },
});
export const workspaceTarget = (
  workspace: ExtensionWorkspace,
  projectId: string,
  metadata?: ResourceRef["metadata"],
): NavigationTargetPage => {
  let page = workspacePages.workspace;
  if (workspace.executionKind !== "local" || workspace.capabilities?.files === "none") page = workspacePages.overview;
  else if (workspace.isDefault || !workspace.capabilities?.diff) page = workspacePages.files;
  if (workspace.device) page = workspacePages.history;
  const params =
    page === workspacePages.workspace
      ? { comparison: workspace.providerId === "pstdio.worktree" ? "fork_point" : "current" }
      : undefined;
  return {
    kind: "page",
    page,
    resource: workspaceResource(workspace, projectId, metadata),
    ...(params ? { params } : {}),
  };
};
export const sessionTarget = (
  session: { id: string; title: string; device?: ExtensionWorkspace["device"] },
  projectId: string,
): NavigationTargetPage => ({
  kind: "page",
  page: sessionBrowser.pages.session,
  resource: {
    type: "session",
    id: session.id,
    projectId,
    extensionId: "pstdio",
    label: session.title,
    ...(session.device ? { device: session.device } : {}),
  },
});
export const filePath = (resource?: ResourceRef) =>
  typeof resource?.metadata?.workspaceFilePath === "string" ? resource.metadata.workspaceFilePath : undefined;
export const entryName = (name: string) => {
  const value = name.trim();
  if (!value || value === "." || value === ".." || /[/\\\0]/.test(value))
    throw new Error("Enter a name without folders.");
  return value;
};
export const parentPath = (path: string) => path.split("/").slice(0, -1).join("/");
export const joinPath = (parent: string, name: string) => (parent ? `${parent}/${entryName(name)}` : entryName(name));
