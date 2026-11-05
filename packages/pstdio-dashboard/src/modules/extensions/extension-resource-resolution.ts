import type { ResourceRef, ResourceResolution } from "@pstdio/sdk/extensions";

export const resourceResolutionRequest = (projectId: string, resource: ResourceRef, batch: boolean) => ({
  projectId,
  resource,
  source: "dashboard" as const,
  ...(batch ? { params: { resources: [resource] } } : {}),
});

export const resolutionFromResult = (
  value: unknown,
  input: {
    batch: boolean;
    identityOf(resource: ResourceRef | undefined): string | undefined;
    open: ResourceRef;
  },
) => {
  if (!input.batch) return { resource: value };
  if (!Array.isArray(value)) return undefined;
  return (value as ResourceResolution[]).find(
    (entry) => entry?.resource && input.identityOf(entry.resource) === input.identityOf(input.open),
  );
};

export const sameResourceReference = (left: ResourceRef, right: ResourceRef) =>
  left.type === right.type &&
  left.id === right.id &&
  left.extensionId === right.extensionId &&
  left.projectId === right.projectId &&
  left.label === right.label &&
  left.icon === right.icon &&
  left.shorthand === right.shorthand &&
  JSON.stringify(left.device ?? null) === JSON.stringify(right.device ?? null) &&
  JSON.stringify(left.metadata ?? {}) === JSON.stringify(right.metadata ?? {});
