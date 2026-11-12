import { getActiveWorkbenchSubPanel, type ResourceRef, type WorkbenchCore } from "../../core";
import { isFullscreenRegionFocusable } from "../../core/controllers/fullscreen/main-fullscreen";

/** Only the currently shown presentation counts; retained and closed tabs remain unread. */
export const visibleResourceKeys = (workbench: WorkbenchCore) => {
  const layout = workbench.layout.getLayout();
  const primary = workbench.pages.getContent()?.resource;
  return (["main", "secondary", "side"] as const).flatMap((region) => {
    const fullscreenVisible = isFullscreenRegionFocusable(workbench, region);
    if (!(fullscreenVisible ?? layout.regions[region].visible)) return [];
    const resource: ResourceRef | undefined =
      region === "main" && primary
        ? primary
        : getActiveWorkbenchSubPanel(layout, region, workbench.getPrimaryResource(), {
            ignoreOwnerResourceKey: region === "side",
          })?.resource;
    return resource ? [workbench.pages.resourceReferenceKey(resource)] : [];
  });
};
