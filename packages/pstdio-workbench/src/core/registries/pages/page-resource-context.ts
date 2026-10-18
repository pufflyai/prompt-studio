import { type ResourceRef, resourceKey } from "@pstdio/sdk/extensions";
import { resourceMatchesConstraint } from "../../shared/contributions/reference-id";
import type { WorkbenchPageContribution, WorkbenchPageResourceCodec } from "./page-registry-types";
import { pageStateOwnerKey } from "./page-state-key";

export const pageResourceContextKey = (
  page: WorkbenchPageContribution | undefined,
  resource: ResourceRef | undefined,
) =>
  JSON.stringify([
    resourceKey(resource),
    page?.document ? (resource?.metadata?.[page.document.metadataKey] ?? null) : null,
  ]);

export const pageResourceInstanceKey = (
  page: WorkbenchPageContribution,
  resource: ResourceRef,
  resources: WorkbenchPageResourceCodec,
) => {
  const normalized = resources.normalize(resource);
  if (page.document && page.resource && resourceMatchesConstraint(page.resource, normalized))
    return pageStateOwnerKey(page, normalized, resources);
  return resources.toUri(normalized);
};
