import { resourceKey } from "@pstdio/sdk/extensions";
import type { ResourceRef } from "../resources/resource-registry";
import { getActiveLocationPlacement } from "./layout-operations";
import type {
  RegisteredWidgetContribution,
  WorkbenchLayout,
  WorkbenchPanelRegion,
  WorkbenchWidgetPlacement,
} from "./layout-types";

const supportsResource = (widget: RegisteredWidgetContribution, resource: ResourceRef | undefined) => {
  if (widget.resourceKinds?.length && (!resource || !widget.resourceKinds.includes(resource.type))) return false;
  if (widget.canOpen && (!resource || !widget.canOpen(resource))) return false;
  return true;
};
export const getActiveWorkbenchSubPanel = (
  layout: WorkbenchLayout,
  region: WorkbenchPanelRegion,
  resource: ResourceRef | undefined,
  options: {
    ignoreOwnerResourceKey?: boolean;
  } = {},
) => {
  const panel = layout.regions[region];
  return panel.widgets.find(
    (placement) =>
      placement.widgetId === panel.activeWidgetId &&
      placement.role === "sub-panel" &&
      (options.ignoreOwnerResourceKey ||
        !placement.ownerResourceKey ||
        placement.ownerResourceKey === resourceKey(resource)),
  );
};
export const getActiveWorkbenchLocationPanel = (layout: WorkbenchLayout) => getActiveLocationPlacement(layout);
const matchesLocationEligibility = (
  widget: RegisteredWidgetContribution,
  resource: ResourceRef | undefined,
  modeId: string | undefined,
  placement?: WorkbenchWidgetPlacement,
  location?: WorkbenchWidgetPlacement,
) => {
  const eligibleLocations = widget.eligibleLocations;
  if (!matchesWorkbenchModeEligibility(widget, modeId)) return false;
  if (
    eligibleLocations?.resourceKinds?.length &&
    (!resource || !eligibleLocations.resourceKinds.includes(resource.type))
  ) {
    return false;
  }
  if (
    eligibleLocations?.resourceIds?.length &&
    (!resource?.id || !eligibleLocations.resourceIds.includes(resource.id))
  ) {
    return false;
  }
  if (eligibleLocations?.canOpen && (!resource || !eligibleLocations.canOpen(resource))) return false;
  if (
    eligibleLocations?.canOpenLocation &&
    !eligibleLocations.canOpenLocation({ resource, viewId: location?.viewId })
  ) {
    return false;
  }
  if (placement?.ownerResourceKey && placement.ownerResourceKey !== resourceKey(resource)) return false;
  return true;
};
export const matchesWorkbenchModeEligibility = (widget: RegisteredWidgetContribution, modeId: string | undefined) => {
  const eligibleModeIds = widget.eligibleLocations?.modeIds;
  return !eligibleModeIds?.length || (modeId !== undefined && eligibleModeIds.includes(modeId));
};
export const isWorkbenchPanelPlacementVisible = (
  widget: RegisteredWidgetContribution,
  resource: ResourceRef | undefined,
  modeId: string | undefined,
  placement?: WorkbenchWidgetPlacement,
  options: {
    ignoreResourceLocation?: boolean;
    location?: WorkbenchWidgetPlacement;
  } = {},
) => {
  if (!supportsResource(widget, placement?.resource ?? resource)) return false;
  if (options.ignoreResourceLocation) return matchesWorkbenchModeEligibility(widget, modeId);
  return matchesLocationEligibility(widget, resource, modeId, placement, options.location);
};
export const matchesWorkbenchPanelMenuOwner = (
  widget: RegisteredWidgetContribution,
  context: {
    locationPanel?: WorkbenchWidgetPlacement;
    subPanel?: WorkbenchWidgetPlacement;
  },
) => {
  const owner = widget.panelMenuOwner ?? { level: "panel" };
  if (owner.contributionId) {
    const activeOwner = context.subPanel ?? context.locationPanel;
    return activeOwner?.contributionId === owner.contributionId;
  }
  if (context.subPanel) {
    return owner.level === "sub-panel";
  }
  if (owner.level === "panel") {
    return true;
  }
  return false;
};
