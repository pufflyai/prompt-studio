import type { ResourceRef } from "../resources/resource-registry";
import { getActiveLocationPlacement } from "./layout-operations";
import type {
  RegisteredWidgetContribution,
  WorkbenchLayout,
  WorkbenchPanelRegion,
  WorkbenchWidgetPlacement,
} from "./layout-types";

interface PanelWidgetEligibilityInput {
  widget: RegisteredWidgetContribution;
  layout: WorkbenchLayout;
  region: WorkbenchPanelRegion;
  resource?: ResourceRef;
  modeId?: string;
}

interface ListEligiblePanelWidgetsInput {
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
) => {
  const panel = layout.regions[region];
  return panel.widgets.find(
    (placement) =>
      placement.widgetId === panel.activeWidgetId &&
      placement.role === "sub-panel" &&
      (!placement.ownerResourceUri || placement.ownerResourceUri === resource?.uri),
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
  if (eligibleLocations?.modeIds?.length && (!modeId || !eligibleLocations.modeIds.includes(modeId))) return false;
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
  if (placement?.ownerResourceUri && placement.ownerResourceUri !== resource?.uri) return false;
  return true;
};

export const matchesWorkbenchPanelMenuOwner = (
  widget: RegisteredWidgetContribution,
  context: {
    locationPanel?: WorkbenchWidgetPlacement;
    subPanel?: WorkbenchWidgetPlacement;
  },
) => {
  const owner = widget.panelMenuOwner ?? { level: "panel" };
  if (owner.level === "panel") {
    return !owner.contributionId || context.locationPanel?.contributionId === owner.contributionId;
  }
  return context.subPanel?.contributionId === owner.contributionId;
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

export const isSubPanelEligible = (input: PanelWidgetEligibilityInput) =>
  input.widget.role === "sub-panel" &&
  supportsPanelRegion(input.widget, input.region) &&
  supportsResource(input.widget, input.resource) &&
  matchesWorkbenchLocationEligibility(input.widget, input.resource, input.modeId) &&
  !hasOpenSingleton(input.widget, input.layout, input.resource);

export const listEligibleSubPanels = (input: ListEligiblePanelWidgetsInput) =>
  input.widgets.filter((widget) => isSubPanelEligible({ ...input, widget }));
