import type { WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import { PAGE_MAIN_SLOT_ID } from "../../registries/pages/page-main";
import { resourceMatchesConstraint } from "../../shared/contributions/reference-id";
import type { WorkbenchCore } from "../../workbench-core-types";

export const pageForMainPlacement = (core: WorkbenchCore, widget: WorkbenchWidgetPlacement) => {
  const identity = widget.placementIdentity;
  if (identity?.kind === "page")
    return identity.slotId === PAGE_MAIN_SLOT_ID && widget.resource ? core.pages.getPage(identity.pageId) : undefined;
  if (identity?.kind !== "mode") return undefined;
  const placement = core.modePlacements
    .listPlacements(identity.modeId)
    .find((entry) => entry.id === identity.placementId);
  if (!placement) return undefined;
  return core.pages.listPages().find((page) => {
    const landing = page.main.kind === "panels" ? page.main.landing : undefined;
    return (
      landing &&
      typeof landing !== "string" &&
      page.modeId === identity.modeId &&
      landing.id === placement.ref.id &&
      landing.extensionId === placement.ref.extensionId &&
      (page.resource
        ? Boolean(widget.resource && resourceMatchesConstraint(page.resource, widget.resource))
        : !widget.resource)
    );
  });
};
