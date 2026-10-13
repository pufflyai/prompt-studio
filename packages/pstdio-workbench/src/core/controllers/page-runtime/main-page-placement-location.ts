import { resourceKey } from "@pstdio/sdk/extensions";
import type { WorkbenchPageOpenInput } from "../../registries/pages/page-registry";
import type { WorkbenchCore } from "../../workbench-core-types";

export const mainPagePlacementLocation = (core: WorkbenchCore, target: WorkbenchPageOpenInput) => {
  const page = core.pages.getPage(target.pageId);
  const tab = core.layout
    .getLayout()
    .regions.main.widgets.find(
      (value) =>
        value.placementIdentity?.kind === "page" &&
        value.placementIdentity.pageId === target.pageId &&
        value.placementIdentity.slotId === "$main" &&
        resourceKey(value.resource) === resourceKey(target.resource),
    );
  if (!page || !tab) return undefined;
  return {
    page: page.ref,
    resource: tab.resource,
    section: tab.section,
    position: tab.position,
    ...tab.pageContext,
  };
};
