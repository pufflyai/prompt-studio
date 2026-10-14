import { type ResourceRef, resourceKey } from "@pstdio/sdk/extensions";

/** An omitted project names the active project in workbench resource operations. */
export const projectResourceKey = (resource: ResourceRef | undefined, projectId: string | undefined) =>
  resource && resourceKey({ ...resource, projectId: resource.projectId ?? projectId });

// Owner scopes preserve the supplied reference. Both permitted forms name the same owner.
export const projectResourceReferences = (resource: ResourceRef, projectId: string | undefined) => {
  const { projectId: _projectId, ...unqualified } = resource;
  return [unqualified, { ...resource, projectId: resource.projectId ?? projectId }];
};
