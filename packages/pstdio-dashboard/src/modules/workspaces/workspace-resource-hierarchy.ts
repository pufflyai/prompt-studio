import type {
  ResourceHierarchyProvider,
  ResourceRef,
  TreeViewSection,
  WorkbenchModuleContributionContext,
} from "@pstdio/workbench/core";
import type { DashboardSession } from "../sessions/data/dashboard-sessions";
import type { DashboardWorkspace } from "./data/dashboard-workspaces";

export const workspaceChildKinds = ["workspace-files", "workspace-diff", "workspace-sessions"] as const;

export type WorkspaceChildKind = (typeof workspaceChildKinds)[number];

export const workspaceChildDefinitions = {
  "workspace-files": { label: "Files", path: "files", icon: "Folder" },
  "workspace-diff": { label: "Diff", path: "diff", icon: "GitCompare" },
  "workspace-sessions": { label: "Sessions", path: "sessions", icon: "MessageSquare" },
} satisfies Record<WorkspaceChildKind, { label: string; path: string; icon: string }>;

const metadataString = (resource: ResourceRef, key: string) => {
  const value = resource.metadata?.[key];
  return typeof value === "string" ? value : undefined;
};

const metadataNumber = (resource: ResourceRef, key: string) => {
  const value = resource.metadata?.[key];
  return typeof value === "number" ? value : undefined;
};

const workspaceId = (resource: ResourceRef) => resource.id ?? metadataString(resource, "workspaceId");

const sessionCount = (workspace: ResourceRef, sessions: DashboardSession[]) => {
  const id = workspaceId(workspace);
  return id ? sessions.filter((session) => session.workspaceId === id).length : 0;
};

const childLabel = (workspace: ResourceRef, kind: WorkspaceChildKind, sessions: DashboardSession[]) => {
  if (kind === "workspace-files") return workspaceChildDefinitions[kind].label;
  if (kind === "workspace-sessions") return `Sessions · ${sessionCount(workspace, sessions)}`;

  const fileCount = metadataNumber(workspace, "diffFileCount");
  return fileCount === undefined ? "Diff" : `Diff · ${fileCount} changed`;
};

export const isWorkspaceChildResource = (resource: ResourceRef) =>
  workspaceChildKinds.includes(resource.kind as WorkspaceChildKind);

export const createWorkspaceChildResource = (
  workspace: ResourceRef,
  kind: WorkspaceChildKind,
  sessions: DashboardSession[],
): ResourceRef => ({
  kind,
  uri: `${workspace.uri}/${workspaceChildDefinitions[kind].path}`,
  id: `${workspaceId(workspace) ?? workspace.uri}:${workspaceChildDefinitions[kind].path}`,
  label: childLabel(workspace, kind, sessions),
  icon: workspaceChildDefinitions[kind].icon,
  metadata: {
    ...workspace.metadata,
    workspaceId: workspaceId(workspace),
    workspaceResourceUri: workspace.uri,
    workspaceResourceLabel: workspace.label,
    workspaceResourceIcon: workspace.icon,
  },
});

interface CreateWorkspaceHierarchyProviderInput {
  listWorkspaces: () => DashboardWorkspace[];
  listSessions: () => DashboardSession[];
}

export const createWorkspaceHierarchyProvider = (
  input: CreateWorkspaceHierarchyProviderInput,
): ResourceHierarchyProvider => {
  const canonicalResources = new Map<string, ResourceRef>();

  const childrenFor = (workspace: ResourceRef) => {
    canonicalResources.set(workspace.uri, workspace);
    const sessions = input.listSessions();
    const children = workspaceChildKinds.map((kind) => createWorkspaceChildResource(workspace, kind, sessions));
    for (const child of children) canonicalResources.set(child.uri, child);
    return children;
  };

  const findWorkspace = (uri: string) => {
    const current = input.listWorkspaces().find(({ resource }) => resource.uri === uri)?.resource;
    if (current) canonicalResources.set(current.uri, current);
    return current ?? canonicalResources.get(uri);
  };

  return {
    id: "dashboard.workspace-hierarchy",
    getResource(uri) {
      const workspaces = input.listWorkspaces();
      const workspace = workspaces.find(({ resource }) => resource.uri === uri)?.resource;
      if (workspace) {
        canonicalResources.set(workspace.uri, workspace);
        return workspace;
      }

      const parent = workspaces.find(({ resource }) => uri.startsWith(`${resource.uri}/`))?.resource;
      return parent ? childrenFor(parent).find((child) => child.uri === uri) : canonicalResources.get(uri);
    },
    getParent(resource) {
      if (!isWorkspaceChildResource(resource)) return undefined;
      const parentUri = metadataString(resource, "workspaceResourceUri");
      return parentUri ? findWorkspace(parentUri) : undefined;
    },
    listChildren(resource) {
      if (resource.kind !== "workspace") return [];
      return childrenFor(findWorkspace(resource.uri) ?? resource);
    },
  };
};

export const createWorkspaceSidenavSections = (
  ctx: WorkbenchModuleContributionContext,
  selectedResource: ResourceRef | undefined,
): TreeViewSection[] => {
  if (!selectedResource) return [];
  const workspace =
    selectedResource.kind === "workspace" ? selectedResource : ctx.resources.getParent(selectedResource);
  if (workspace?.kind !== "workspace") return [];

  const children = ctx.resources.listChildren(workspace);
  return [
    {
      id: "workspace-heading",
      canReorder: false,
      nodes: [
        {
          id: `workspace-heading:${workspace.uri}`,
          label: workspace.label ?? "Workspace",
          icon: workspace.icon ?? "GitBranch",
          iconColor: "fg.info",
          disabled: true,
          canReorder: false,
        },
      ],
    },
    {
      id: "workspace-children",
      nodes: children.map((resource) => ({
        id: resource.uri,
        label: resource.label ?? resource.kind,
        icon: resource.icon,
        resource,
        canHide: true,
      })),
    },
  ];
};
