import type { PageLocation } from "@pstdio/sdk/extensions";
import { pageOwnerResource } from "./page-main";
import type { WorkbenchPageContribution, WorkbenchPageResourceCodec } from "./page-registry-types";

export const pageStateKey = (
  page: WorkbenchPageContribution,
  location: PageLocation | undefined,
  resources: WorkbenchPageResourceCodec,
) => {
  const resource = pageOwnerResource(page, location?.resource);
  return resource ? `${page.id}|${resources.toUri(resources.normalize(resource))}` : page.id;
};

export const removePageStates = <State>(states: Readonly<Record<string, State>>, pageId: string) =>
  Object.fromEntries(Object.entries(states).filter(([key]) => key !== pageId && !key.startsWith(`${pageId}|`)));
