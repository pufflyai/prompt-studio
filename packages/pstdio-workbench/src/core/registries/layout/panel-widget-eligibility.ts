import type { ResourceRef } from "../resources/resource-registry";
import type { RegisteredWidgetContribution, WorkbenchLayout, WorkbenchPanelRegion } from "./layout-types";

interface PanelWidgetEligibilityInput {
  widget: RegisteredWidgetContribution;
  layout: WorkbenchLayout;
  region: WorkbenchPanelRegion;
  resource?: ResourceRef;
}

interface ListEligiblePanelWidgetsInput {
  widgets: RegisteredWidgetContribution[];
  layout: WorkbenchLayout;
  region: WorkbenchPanelRegion;
  resource?: ResourceRef;
}

const supportsPanelRegion = (widget: RegisteredWidgetContribution, region: WorkbenchPanelRegion) =>
  widget.region === region || widget.fallbackRegion === region;

const supportsResource = (widget: RegisteredWidgetContribution, resource: ResourceRef | undefined) => {
  if (widget.resourceKinds?.length && (!resource || !widget.resourceKinds.includes(resource.kind))) return false;
  if (widget.canOpen && (!resource || !widget.canOpen(resource))) return false;
  return true;
};

const hasOpenSingleton = (widget: RegisteredWidgetContribution, layout: WorkbenchLayout) =>
  widget.singleton &&
  Object.values(layout.regions).some((region) =>
    region.widgets.some((placement) => placement.contributionId === widget.id),
  );

export const isWidgetEligibleForPanel = (input: PanelWidgetEligibilityInput) =>
  input.widget.panelAddable === true &&
  supportsPanelRegion(input.widget, input.region) &&
  supportsResource(input.widget, input.resource) &&
  !hasOpenSingleton(input.widget, input.layout);

export const listEligiblePanelWidgets = (input: ListEligiblePanelWidgetsInput) =>
  input.widgets.filter((widget) => isWidgetEligibleForPanel({ ...input, widget }));
