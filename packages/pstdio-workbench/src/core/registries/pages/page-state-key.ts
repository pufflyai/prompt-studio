import type { PageLocation, ResourceRef } from "@pstdio/sdk/extensions";
import { workbenchPageLocationKey } from "../../controllers/page-location/page-location-normalization";
import type { WorkbenchPageContribution, WorkbenchPageResourceCodec } from "./page-registry-types";

export const pageStateOwnerKey = (
  page: WorkbenchPageContribution,
  resource: ResourceRef | undefined,
  resources: WorkbenchPageResourceCodec,
) =>
  page.resource && resource
    ? `${page.id}|${JSON.stringify([
        resources.toUri(resources.normalize(resource)),
        page.document ? resource.metadata?.[page.document.metadataKey] : null,
      ])}`
    : page.id;

export const staticPageInstanceKey = (
  page: WorkbenchPageContribution,
  resource: ResourceRef | undefined,
  resources: WorkbenchPageResourceCodec,
) => (page.resource && resource ? pageStateOwnerKey(page, resource, resources) : "default");

export const ownsStaticPageInstance = (key: string, pageId: string, instanceKey: string) => {
  const owner = instanceKey === "default" ? pageId : instanceKey;
  return key === owner || key.startsWith(`${owner}|`);
};

export const pageStateKey = (
  page: WorkbenchPageContribution,
  location: PageLocation | undefined,
  resources: WorkbenchPageResourceCodec,
) =>
  (page.main.kind === "panels" || page.resource) && location
    ? `${pageStateOwnerKey(page, location.resource, resources)}|${workbenchPageLocationKey({ ...location, position: undefined }, resources)}`
    : page.id;

export const removePageStates = <State>(states: Readonly<Record<string, State>>, pageId: string) =>
  Object.fromEntries(Object.entries(states).filter(([key]) => key !== pageId && !key.startsWith(`${pageId}|`)));
