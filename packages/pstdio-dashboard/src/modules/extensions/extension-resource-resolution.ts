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
