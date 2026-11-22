import type { ResourceConstraint, ResourceRef } from "@pstdio/sdk/extensions";
import { canonicalExtensionId, historicalExtensionId } from "pstdio-api-contracts/extension-host";
import { resourceMatchesConstraint } from "./reference-id";

export const canonicalResourceRef = (resource: ResourceRef): ResourceRef =>
  resource.extensionId && canonicalExtensionId(resource.extensionId) !== resource.extensionId
    ? { ...resource, extensionId: canonicalExtensionId(resource.extensionId) }
    : resource;
export const historicalResourceRef = (resource: ResourceRef): ResourceRef =>
  resource.extensionId ? { ...resource, extensionId: historicalExtensionId(resource.extensionId) } : resource;

/** Resolve omitted link qualifiers from declared context, without rewriting persisted references. */
export const contextualResourceRef = (
  resource: ResourceRef,
  projectId: string | undefined,
  kinds: ResourceConstraint["kinds"],
): ResourceRef => {
  const canonical = canonicalResourceRef(resource);
  const owners = new Set(
    kinds
      .filter((kind) => resourceMatchesConstraint({ kinds: [kind] }, canonical))
      .map((kind) => canonicalExtensionId(kind.extensionId ?? "")),
  );
  const extensionId = canonical.extensionId ?? (owners.size === 1 ? [...owners][0] : undefined);
  return {
    ...canonical,
    ...(extensionId ? { extensionId } : {}),
    ...((canonical.projectId ?? projectId) ? { projectId: canonical.projectId ?? projectId } : {}),
  };
};
