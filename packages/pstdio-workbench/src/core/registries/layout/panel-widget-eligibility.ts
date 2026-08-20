import type { ResourceRef } from "../resources/resource-registry";
import { getActiveLocationPlacement } from "./layout-operations";
import type {
  RegisteredWidgetContribution,
  WorkbenchLayout,
  WorkbenchPanelRegion,
  WorkbenchWidgetPlacement,
} from "./layout-types";

interface PanelWidgetEligibilityInput {
  addableWidgetIds?: readonly string[];
  widget: RegisteredWidgetContribution;
  layout: WorkbenchLayout;
  region: WorkbenchPanelRegion;
  resource?: ResourceRef;
  modeId?: string;
}

interface ListEligiblePanelWidgetsInput {
  addableWidgetIds?: readonly string[];
  widgets: RegisteredWidgetContribution[];
  layout: WorkbenchLayout;
  region: WorkbenchPanelRegion;
  resource?: ResourceRef;
  modeId?: string;
}

const supportsPanelRegion = (widget: RegisteredWidgetContribution, region: WorkbenchPanelRegion) =>
  widget.region === region || widget.fallbackRegion === region;

const supportsResource = (widget: RegisteredWidgetContribution, resource: ResourceRef | undefined) => {
  if (widget.resourceKinds?.length && (!resource || !widget.resourceKinds.includes(resource.kind))) return false;
  if (widget.canOpen && (!resource || !widget.canOpen(resource))) return false;
  return true;
};

export const getActiveWorkbenchSubPanel = (
  layout: WorkbenchLayout,
  region: WorkbenchPanelRegion,
  resource: ResourceRef | undefined,
  options: { ignoreOwnerResourceUri?: boolean } = {},
) => {
  const panel = layout.regions[region];
  return panel.widgets.find(
    (placement) =>
      placement.widgetId === panel.activeWidgetId &&
      placement.role === "sub-panel" &&
      (options.ignoreOwnerResourceUri || !placement.ownerResourceUri || placement.ownerResourceUri === resource?.uri),
  );
};

export const getActiveWorkbenchLocationPanel = (layout: WorkbenchLayout) => getActiveLocationPlacement(layout);

export const matchesWorkbenchLocationEligibility = (
  widget: RegisteredWidgetContribution,
  resource: ResourceRef | undefined,
  modeId: string | undefined,
  placement?: WorkbenchWidgetPlacement,
) => {
  const eligibleLocations = widget.eligibleLocations;
  if (!matchesWorkbenchModeEligibility(widget, modeId)) return false;
  if (
    eligibleLocations?.resourceKinds?.length &&
    (!resource || !eligibleLocations.resourceKinds.includes(resource.kind))
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
  if (placement?.ownerResourceUri && placement.ownerResourceUri !== resource?.uri) return false;
  return true;
};

export const matchesWorkbenchModeEligibility = (widget: RegisteredWidgetContribution, modeId: string | undefined) => {
  const eligibleModeIds = widget.eligibleLocations?.modeIds;
  return !eligibleModeIds?.length || (modeId !== undefined && eligibleModeIds.includes(modeId));
};

export const matchesWorkbenchPanelPlacementLocation = (
  widget: RegisteredWidgetContribution,
  resource: ResourceRef | undefined,
  modeId: string | undefined,
  placement: WorkbenchWidgetPlacement,
  options: { ignoreResourceLocation?: boolean } = {},
) => {
  if (!supportsResource(widget, placement.resource ?? resource)) return false;
  if (options.ignoreResourceLocation) return matchesWorkbenchModeEligibility(widget, modeId);
  return matchesWorkbenchLocationEligibility(widget, resource, modeId, placement);
};

export const allowsWorkbenchFloatingPanels = (
  layout: WorkbenchLayout,
  widgets: readonly RegisteredWidgetContribution[],
) => {
  const activeMainPanel =
    layout.regions.main.widgets.find((placement) => placement.widgetId === layout.regions.main.activeWidgetId) ??
    getActiveLocationPlacement(layout);
  if (!activeMainPanel) return true;

  return widgets.find((widget) => widget.id === activeMainPanel.contributionId)?.floatingPanels !== "hidden";
};

export const matchesWorkbenchPanelMenuOwner = (
  widget: RegisteredWidgetContribution,
  context: {
    locationPanel?: WorkbenchWidgetPlacement;
    subPanel?: WorkbenchWidgetPlacement;
  },
) => {
  const owner = widget.panelMenuOwner ?? { level: "panel" };
  if (context.subPanel) {
    return owner.level === "sub-panel" && context.subPanel.contributionId === owner.contributionId;
  }
  if (owner.level === "panel") {
    return !owner.contributionId || context.locationPanel?.contributionId === owner.contributionId;
  }
  return false;
};

const hasOpenSingleton = (
  widget: RegisteredWidgetContribution,
  layout: WorkbenchLayout,
  resource: ResourceRef | undefined,
) =>
  widget.singleton &&
  Object.values(layout.regions).some((region) =>
    region.widgets.some(
      (placement) => placement.contributionId === widget.id && placement.ownerResourceUri === resource?.uri,
    ),
  );

export const isSubPanelEligible = (input: PanelWidgetEligibilityInput) => {
  if (hasOpenSingleton(input.widget, input.layout, input.resource)) return false;
  if (input.addableWidgetIds?.includes(input.widget.id)) return true;
  return (
    input.widget.role === "sub-panel" &&
    supportsPanelRegion(input.widget, input.region) &&
    supportsResource(input.widget, input.resource) &&
    matchesWorkbenchLocationEligibility(input.widget, input.resource, input.modeId)
  );
};

export const listEligibleSubPanels = (input: ListEligiblePanelWidgetsInput) =>
  input.widgets.filter((widget) => isSubPanelEligible({ ...input, widget }));
