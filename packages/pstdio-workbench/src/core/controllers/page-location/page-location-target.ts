import type { NavigationTargetPage, PageLocation } from "@pstdio/sdk/extensions";

export const pageLocationTarget = (location: PageLocation): NavigationTargetPage => ({
  kind: "page",
  page: location.page,
  ...(location.resource ? { resource: location.resource } : {}),
  ...(location.section ? { section: location.section } : {}),
  ...(location.position ? { position: location.position } : {}),
  ...(location.params ? { params: location.params } : {}),
  ...(location.parent ? { parent: pageLocationTarget(location.parent) } : {}),
});
