import type { ResourceRef } from "@pstdio/workbench/core";

interface ResourceChildrenInput {
  resource?: ResourceRef;
  children: readonly ResourceRef[];
}

export const createResourceChildrenSections = (input: ResourceChildrenInput) => {
  const { resource, children } = input;
  if (!resource || children.length === 0) return [];

  return [
    {
      id: "resource-children",
      resource,
      nodes: children.map((child) => ({
        id: child.uri,
        label: child.label ?? child.uri,
        ...(child.icon ? { icon: child.icon } : {}),
        resource: child,
      })),
    },
  ];
};
