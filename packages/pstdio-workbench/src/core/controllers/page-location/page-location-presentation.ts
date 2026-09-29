import { isLocalizedString, type NavigationTargetPage, type PageLocation } from "@pstdio/sdk/extensions";
import type { WorkbenchPageContribution } from "../../registries/pages/page-registry";

export const targetFromLocation = (location: PageLocation): NavigationTargetPage => ({
  kind: "page",
  page: location.page,
  ...(location.resource ? { resource: location.resource } : {}),
  ...(location.section ? { section: location.section } : {}),
  ...(location.parent ? { parent: targetFromLocation(location.parent) } : {}),
});

export const pageLocationTitle = (location: PageLocation, pages: readonly WorkbenchPageContribution[]) => {
  if (location.resource?.label !== undefined) return location.resource.label;
  const page = pages.find(
    (page) => page.ref.id === location.page.id && page.ref.extensionId === location.page.extensionId,
  );
  if (page?.title === undefined) return location.page.id;
  return isLocalizedString(page.title) ? (page.title.default ?? page.title.$l10n) : page.title;
};
