import type { ResourceRef } from "@pstdio/workbench/core";
import { buildSessionGroupChildren } from "../sessions/session-tree-nodes";

interface ResourceChildrenInput {
  resource?: ResourceRef;
  children: readonly ResourceRef[];
}

const metadataString = (resource: ResourceRef, key: string) => {
  const value = resource.metadata?.[key];
  return typeof value === "string" ? value : undefined;
};

const createResourceNode = (child: ResourceRef) => ({
  id: child.uri,
  label: child.label ?? child.uri,
  ...(child.icon ? { icon: child.icon } : {}),
  resource: child,
});

const createWorkspaceSessionGroup = (children: readonly ResourceRef[]) => ({
  id: "sessions",
  label: "Sessions",
  canHide: true,
  collapsible: true,
  children: buildSessionGroupChildren(
    children.map((resource) => ({
      title: resource.label ?? resource.uri,
      status: metadataString(resource, "status") ?? "unknown",
      lastActivityAt: metadataString(resource, "lastActivityAt") ?? "1970-01-01T00:00:00.000Z",
      resource,
    })),
    "side",
  ),
});

export const createResourceChildrenSections = (input: ResourceChildrenInput) => {
  const { resource, children } = input;
  if (!resource) return [];

  if (resource.kind === "workspace") {
    const sessionChildren = children.filter((child) => child.kind === "session");
    const otherChildren = children.filter((child) => child.kind !== "session");

    return [
      {
        id: "resource-children",
        resource,
        nodes: [createWorkspaceSessionGroup(sessionChildren), ...otherChildren.map(createResourceNode)],
      },
    ];
  }

  if (children.length === 0) return [];

  const isTicketWorkspaceList = resource.kind === "ticket" && children.every((child) => child.kind === "workspace");

  return [
    {
      id: "resource-children",
      resource,
      ...(isTicketWorkspaceList ? { label: "Workspaces" } : {}),
      nodes: children.map(createResourceNode),
    },
  ];
};
