import type { LayoutModel } from "../../registries/layout/layout-model";
import type { WorkbenchLayout, WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import type { ResolvedOwnedPlacement } from "../../registries/layout/placement-reconciliation";
import { placementIdentityKey } from "../../registries/layout/placement-reconciliation";
import type { WorkbenchPagePlacementInput } from "../../registries/pages/page-registry";
import { SINGLE_RESOURCE_INSTANCE_KEY } from "../../registries/placements/placement-instance-key";
import { replaceLayoutWidgetIds } from "./owner-layout-widgets";

export const pageWidgetId = (input: WorkbenchPagePlacementInput, layout: LayoutModel) => {
  const key = placementIdentityKey(input.identity);
  const placements = Object.values(layout.getLayout().regions).flatMap((region) => region.widgets);
  if (input.identity.instanceKey === SINGLE_RESOURCE_INSTANCE_KEY) {
    const current = placements.find(
      (placement) =>
        !placement.declarationIdentity &&
        placement.placementIdentity &&
        placementIdentityKey(placement.placementIdentity) === key,
    );
    if (current) return current.widgetId;
    return `workbench.page.${crypto.randomUUID()}`;
  }
  return `workbench.page.${encodeURIComponent(input.ownerInstanceKey ?? "")}.${encodeURIComponent(key)}`;
};

export const reuseSingleResourceWidgets = (
  layout: WorkbenchLayout,
  placements: readonly ResolvedOwnedPlacement<WorkbenchWidgetPlacement>[],
) => {
  const desired = new Map(
    placements
      .filter(
        (p) =>
          p.identity.kind === "page" &&
          p.identity.instanceKey === SINGLE_RESOURCE_INSTANCE_KEY &&
          !p.value.declarationIdentity,
      )
      .map((p) => [placementIdentityKey(p.identity), p.value.widgetId]),
  );
  const replacements = new Map<string, string>();
  for (const region of Object.values(layout.regions)) {
    for (const p of region.widgets) {
      const widgetId = p.placementIdentity ? desired.get(placementIdentityKey(p.placementIdentity)) : undefined;
      if (widgetId && widgetId !== p.widgetId) replacements.set(p.widgetId, widgetId);
    }
  }
  return replaceLayoutWidgetIds(layout, replacements);
};
