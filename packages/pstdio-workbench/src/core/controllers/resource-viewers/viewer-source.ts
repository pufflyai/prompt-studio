import type { PlacementIdentity } from "@pstdio/sdk/extensions";
import { getWorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";
import type { WorkbenchCore } from "../../workbench-core-types";
import { sameViewer } from "./displayed-viewers";
import { transferredViewerIdentity } from "./viewer-host-continuity";

export const currentViewerSource = (core: WorkbenchCore, identity: PlacementIdentity) => {
  const originalIdentity = identity;
  const content = core.pages.getContent();
  if (content?.placementIdentity && sameViewer(content.placementIdentity, identity))
    return { region: "main" as const, widget: content, identity, resource: content.resource };
  identity = transferredViewerIdentity(core, identity);
  if (content?.placementIdentity && sameViewer(content.placementIdentity, identity))
    return { region: "main" as const, widget: content, identity, resource: content.resource };
  for (const region of ["main", "side", "secondary"] as const) {
    const widget = core.layout
      .getLayout()
      .regions[region].widgets.find(
        (widget) => widget.placementIdentity && sameViewer(widget.placementIdentity, identity),
      );
    if (widget) return { region, widget, identity, resource: widget.resource };
  }
  if (identity !== originalIdentity) {
    const proposed = getWorkbenchPageRegistryInternals(core.pages)
      .getPublishingState()
      .placements.find((entry) => sameViewer(entry.identity, identity));
    if (proposed && ["main", "side", "secondary"].includes(proposed.region))
      return {
        region: proposed.region as "main" | "side" | "secondary",
        widget: proposed.value,
        identity,
        resource: proposed.value.resource,
      };
  }
  return undefined;
};
